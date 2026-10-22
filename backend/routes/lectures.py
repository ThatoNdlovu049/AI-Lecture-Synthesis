from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Annotated
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from model.database import SessionLocal
from model.models import User, Lecture, LectureNote
from routes.auth import get_current_user
import json
import time

router = APIRouter(
    prefix="/ai/lectures",
    tags=["lectures"]
)

notes_router = APIRouter(
    prefix="/ai/notes",
    tags=["notes"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
user_dependency = Annotated[dict, Depends(get_current_user)]


######Live progress of lecture generation
# Kept in memory: it only matters while the server that's generating is running.
# The stages match the steps in routes/ai.py upload_slides.

STAGES = ["upload", "script", "voice", "lipsync", "subtitles", "slides"]

jobs = {}

def track_progress(job_id : str):
    """Returns update(stage, current=None, total=None, detail=None) for one generation."""
    started = time.time()

    def update(stage : str, current : int | None = None, total : int | None = None, detail : str | None = None):
        previous = jobs.get(job_id, {})
        stage_started = previous.get("stage_started", started) if previous.get("stage") == stage else time.time()
        jobs[job_id] = {
            "stage": stage,
            "current": current,
            "total": total,
            "detail": detail,
            "started": started,
            "stage_started": stage_started,
        }

    update("upload")
    return update


######Saving the finished lecture

def finish_lecture(lecture_id : int | None, video_url : str, slides : list, subtitles : list):
    if lecture_id is None:
        return
    db = SessionLocal()
    try:
        lecture = db.get(Lecture, lecture_id)
        lecture.status = "ready"
        lecture.video_url = video_url
        lecture.slides = json.dumps(slides)
        lecture.subtitles = json.dumps(subtitles)
        db.commit()
    finally:
        db.close()

def fail_lecture(lecture_id : int | None, job_id : str, error : str):
    if job_id in jobs:
        jobs[job_id]["failed"] = error
    if lecture_id is None:
        return
    db = SessionLocal()
    try:
        lecture = db.get(Lecture, lecture_id)
        lecture.status = "failed"
        lecture.error = error
        db.commit()
    finally:
        db.close()


######Routes

def lecture_summary(lecture : Lecture, owner : User, user_id : int):
    return {
        "key": lecture.job_id,
        "course_name": lecture.course_name,
        "status": lecture.status,
        "video_url": lecture.video_url,
        "owner_id": owner.id,
        "owner_name": f"{owner.first_name} {owner.last_name}",
        "owner_role": owner.role,
        "is_mine": owner.id == user_id,
        "created_at": lecture.created_at.isoformat() if lecture.created_at else None,
    }

def live_status(lecture : Lecture):
    # "generating" in the database but unknown to this server means the
    # server was restarted part-way through, so the job will never finish.
    if lecture.status == "generating" and lecture.job_id not in jobs:
        return "interrupted"
    return lecture.status

@router.get("", status_code=status.HTTP_200_OK)
async def list_lectures(user : user_dependency, db : db_dependency):
    """The user's own lectures (any status) and every lecturer's finished lectures."""

    rows = (
        db.query(Lecture, User)
        .join(User, Lecture.owner_id == User.id)
        .filter(Lecture.job_id.isnot(None))
        .filter((User.id == user["user_id"]) | ((User.role == "lecturer") & (Lecture.status == "ready")))
        .order_by(Lecture.created_at.desc())
        .all()
    )

    lectures = []
    for lecture, owner in rows:
        summary = lecture_summary(lecture, owner, user["user_id"])
        summary["status"] = live_status(lecture)
        lectures.append(summary)

    return {"lectures": lectures}

@router.get("/{job_id}", status_code=status.HTTP_200_OK)
async def get_lecture(job_id : str, user : user_dependency, db : db_dependency):

    row = (
        db.query(Lecture, User)
        .join(User, Lecture.owner_id == User.id)
        .filter(Lecture.job_id == job_id)
        .first()
    )

    if row is None:
        # The upload request may still be sending files, before the lecture is saved.
        progress = jobs.get(job_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found" if progress is None else "Lecture not saved yet")

    lecture, owner = row
    if owner.id != user["user_id"] and not (owner.role == "lecturer" and lecture.status == "ready"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")

    result = lecture_summary(lecture, owner, user["user_id"])
    result["status"] = live_status(lecture)
    result["error"] = lecture.error
    result["slides"] = json.loads(lecture.slides) if lecture.slides else []
    result["subtitles"] = json.loads(lecture.subtitles) if lecture.subtitles else []

    progress = jobs.get(job_id)
    if progress and owner.id == user["user_id"]:
        now = time.time()
        result["progress"] = {
            "stage": progress["stage"],
            "stages": STAGES,
            "current": progress["current"],
            "total": progress["total"],
            "detail": progress["detail"],
            "elapsed": round(now - progress["started"]),
            "stage_elapsed": round(now - progress["stage_started"]),
        }

    return result


######Notes - private to each user, any number per lecture
# The lecture key goes in the query/body rather than the URL path because
# older "local:..." keys contain characters that don't belong in a path.

class NewNoteRequest(BaseModel):
    lecture_key : str = Field(min_length=1, max_length=300)
    content : str = Field(max_length=50_000)
    video_time : float | None = Field(default=None, ge=0)  # seconds into the video

class NoteUpdateRequest(BaseModel):
    content : str = Field(max_length=50_000)

def note_response(note : LectureNote):
    return {
        "id": note.id,
        "content": note.content,
        "video_time": note.video_time,
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
    }

def get_own_note(db : Session, note_id : int, user_id : int):
    note = db.query(LectureNote).filter(LectureNote.id == note_id, LectureNote.user_id == user_id).first()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note

@notes_router.get("", status_code=status.HTTP_200_OK)
async def notes_per_lecture(user : user_dependency, db : db_dependency):
    """How many notes this user has on each lecture, so lists can mark them."""
    rows = (
        db.query(LectureNote.lecture_key, func.count(LectureNote.id))
        .filter(LectureNote.user_id == user["user_id"], LectureNote.content != "")
        .group_by(LectureNote.lecture_key)
        .all()
    )
    return {"notes": [{"lecture_key": key, "count": count} for key, count in rows]}

@notes_router.get("/lecture", status_code=status.HTTP_200_OK)
async def lecture_notes(key : str, user : user_dependency, db : db_dependency):
    notes = (
        db.query(LectureNote)
        .filter(LectureNote.user_id == user["user_id"], LectureNote.lecture_key == key)
        .order_by(LectureNote.created_at)
        .all()
    )
    return {"notes": [note_response(n) for n in notes]}

@notes_router.post("/lecture", status_code=status.HTTP_201_CREATED)
async def add_note(request : NewNoteRequest, user : user_dependency, db : db_dependency):
    now = datetime.now(timezone.utc)
    note = LectureNote(
        user_id=user["user_id"],
        lecture_key=request.lecture_key,
        content=request.content,
        video_time=request.video_time,
        created_at=now,
        updated_at=now
    )
    db.add(note)
    db.commit()
    return note_response(note)

@notes_router.put("/{note_id}", status_code=status.HTTP_200_OK)
async def edit_note(note_id : int, request : NoteUpdateRequest, user : user_dependency, db : db_dependency):
    note = get_own_note(db, note_id, user["user_id"])
    note.content = request.content
    note.updated_at = datetime.now(timezone.utc)
    db.commit()
    return note_response(note)

@notes_router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id : int, user : user_dependency, db : db_dependency):
    db.delete(get_own_note(db, note_id, user["user_id"]))
    db.commit()
