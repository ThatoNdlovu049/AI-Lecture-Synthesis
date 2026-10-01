from model.database import Base
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone


class User(Base):

    __tablename__ = "users"
    id = Column(Integer, primary_key=True, unique=True)
    first_name = Column(String)
    last_name = Column(String)
    username = Column(String)
    email = Column(String, unique=True)
    password = Column(String)
    role = Column(String)


def _now():
    return datetime.now(timezone.utc)


class Job(Base):
    """One lecture-generation request, queued by the API and run by worker.py."""

    __tablename__ = "jobs"
    id = Column(String, primary_key=True)
    user_id = Column(Integer, index=True)
    status = Column(String, default="queued")  # queued | running | done | failed
    step = Column(String, default="Waiting in the queue")
    video_path = Column(String)
    audio_sample_path = Column(String)
    materials_dir = Column(String)
    video_url = Column(String, nullable=True)
    error = Column(String, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
