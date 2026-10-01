import shutil
import uuid
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Depends
import asyncio
import ollama
from routes.auth import get_current_user
from typing import Annotated
import os
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from model.database import SessionLocal
from model.models import Job
from lecture_text import get_text_from_pdf, generate_prompt
import worker_manager

router = APIRouter(
    prefix="/ai",
    tags=["ai"]
)

model_name = "llama3.1:8b"
keep_ollama_alive = "30m"

# Lecture videos are built by worker.py in a separate process. This file only
# queues jobs and reports their progress, so the chatbot is never blocked.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(BACKEND_DIR, "jobs"), exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
user_dependency = Annotated[dict, Depends(get_current_user)]


def job_to_dict(job : Job, db : Session):
    step = job.step
    if job.status == "queued":
        ahead = db.query(Job).filter(Job.status.in_(["queued", "running"]), Job.created_at < job.created_at).count()
        step = f"Waiting in the queue ({ahead} ahead)" if ahead else "Waiting in the queue"

    return {
        "jobId": job.id,
        "status": job.status,
        "step": step,
        "videoUrl": job.video_url,
        "error": job.error,
        "lectureFileName": "Lecture 1",
        "slidesFileName": "Slides 1",
    }


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_slides(user : user_dependency, db : db_dependency, video : UploadFile, audio_sample : UploadFile, materials: list[UploadFile] = File(...)):

    if user is None:
        raise HTTPException(status_code=400, detail="Authentication failed")

    for material in materials:
        filename = material.filename.lower()
        if not (filename.endswith(".pdf") or filename.endswith(".docx")):
            raise HTTPException(status_code=400, detail="File type not supported")

    if not video.file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video file not found")

    if not audio_sample.file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio file not found")

    # Every job gets its own folder, so two lectures never share files
    job_id = uuid.uuid4().hex
    job_dir = f"jobs/{job_id}"
    materials_dir = f"{job_dir}/materials"
    os.makedirs(os.path.join(BACKEND_DIR, materials_dir), exist_ok=True)

    video_path = f"{job_dir}/video{os.path.splitext(video.filename)[1]}"
    with open(os.path.join(BACKEND_DIR, video_path), "wb") as f:
        shutil.copyfileobj(video.file, f)

    audio_sample_path = f"{job_dir}/audio_sample{os.path.splitext(audio_sample.filename)[1]}"
    with open(os.path.join(BACKEND_DIR, audio_sample_path), "wb") as f:
        shutil.copyfileobj(audio_sample.file, f)

    for i, material in enumerate(materials):
        safe_name = f"{i:02d}_{os.path.basename(material.filename)}"
        with open(os.path.join(BACKEND_DIR, materials_dir, safe_name), "wb") as f:
            shutil.copyfileobj(material.file, f)

    job = Job(
        id=job_id,
        user_id=user.get("user_id"),
        status="queued",
        step="Waiting in the queue",
        video_path=video_path,
        audio_sample_path=audio_sample_path,
        materials_dir=materials_dir,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Starts the worker if it is not running (for example after a crash)
    worker_manager.ensure_running()

    return job_to_dict(job, db)


@router.get("/jobs/{job_id}")
async def get_job(user : user_dependency, db : db_dependency, job_id : str):

    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None or job.user_id != user.get("user_id"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture job not found")

    return job_to_dict(job, db)


@router.post("/script")
async def check_generated_lecture(file : UploadFile, language : str):

    text = await file.read()
    text = get_text_from_pdf(text)
    prompt = generate_prompt(text, language)

    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=model_name,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
    except Exception as e:
        print(f"Ollama error: {e}")
        raise HTTPException(status_code=502, detail=f"Ollama error: {str(e)}")

    print("Text successfully generated from ai")

    #path = await generate_audio(response["message"]["content"])

    return {"script": response["message"]["content"]}

class AskRequest(BaseModel):
    question: str = Field(min_length=1)
    course: str | None = None

@router.post("/ask")
async def ask_assistant(user : user_dependency, request : AskRequest):

    if user is None:
        raise HTTPException(status_code=400, detail="Authentication failed")

    system_prompt = "You are a friendly teaching assistant. Answer students' questions clearly and concisely in plain language, using short examples where helpful."
    if request.course:
        system_prompt += f" The student is currently studying the lecture: {request.course}."

    try:
        response = await asyncio.to_thread(
            ollama.chat,
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.question}
            ]
        )
    except Exception as e:
        print(f"Ollama error: {e}")
        raise HTTPException(status_code=502, detail=f"Ollama error: {str(e)}")

    return {"question": request.question, "answer": response["message"]["content"]}
