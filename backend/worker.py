"""Lecture worker: a separate process that builds the lecture videos.

The API server only queues jobs (POST /ai/upload). This process picks them up
one at a time and runs pipeline.py, so video generation never blocks the
chatbot, and if generation crashes only that job fails.

The API starts this worker automatically (see worker_manager.py) and writes its
output to worker.log. To run it by hand instead, start the API with
START_WORKER=0 and run `python worker.py` from the backend folder.
"""
import os
import sys
import time
import traceback

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv()

from model.database import SessionLocal, engine
from model.models import Base, Job

POLL_SECONDS = 2
_lock_file = None


def acquire_single_instance_lock():
    """Exit if another worker is already running (the lock frees when it exits)."""
    global _lock_file
    _lock_file = open(os.path.join(BACKEND_DIR, "worker.lock"), "a+")
    try:
        if os.name == "nt":
            import msvcrt
            _lock_file.seek(0)
            msvcrt.locking(_lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(_lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print("[worker] Another worker is already running; this one is exiting.", flush=True)
        sys.exit(0)


def update_job(job_id, **fields):
    db = SessionLocal()
    try:
        db.query(Job).filter(Job.id == job_id).update(fields)
        db.commit()
    finally:
        db.close()


def claim_next_job():
    """Marks the oldest queued job as running and returns its details."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.status == "queued").order_by(Job.created_at).first()
        if job is None:
            return None
        details = {
            "id": job.id,
            "video_path": job.video_path,
            "audio_sample_path": job.audio_sample_path,
            "materials_dir": job.materials_dir,
        }
        claimed = db.query(Job).filter(Job.id == job.id, Job.status == "queued") \
            .update({"status": "running", "step": "Starting"})
        db.commit()
        return details if claimed else None
    finally:
        db.close()


def run_job(job, pipeline):
    job_id = job["id"]
    print(f"[worker] Job {job_id} started", flush=True)
    try:
        materials = sorted(
            os.path.join(job["materials_dir"], name) for name in os.listdir(job["materials_dir"])
        )
        video_url = pipeline.run_pipeline(
            os.path.dirname(job["video_path"]),
            job["video_path"],
            job["audio_sample_path"],
            materials,
            set_step=lambda step: update_job(job_id, step=step),
        )
        update_job(job_id, status="done", step="Finished", video_url=video_url)
        print(f"[worker] Job {job_id} finished: {video_url}", flush=True)
    except Exception as e:
        traceback.print_exc()
        update_job(job_id, status="failed", error=str(e) or e.__class__.__name__)
        print(f"[worker] Job {job_id} failed: {e}", flush=True)


def main():
    acquire_single_instance_lock()
    Base.metadata.create_all(bind=engine)

    # A job still marked "running" means a previous worker stopped part-way through it
    db = SessionLocal()
    try:
        db.query(Job).filter(Job.status == "running").update({
            "status": "failed",
            "error": "The worker stopped while this lecture was being generated. Please generate it again.",
        })
        db.commit()
    finally:
        db.close()

    print("[worker] Loading the voice and lip-sync models...", flush=True)
    import pipeline
    pipeline.load_models()
    print("[worker] Ready, waiting for lecture jobs", flush=True)

    while True:
        job = claim_next_job()
        if job:
            run_job(job, pipeline)
        else:
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
