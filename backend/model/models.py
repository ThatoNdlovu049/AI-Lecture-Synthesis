from model.database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
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


# Content behind each generated lecture, kept so the chatbot can answer
# questions about it (see routes/chat.py).
class Lecture(Base):

    __tablename__ = "lectures"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    course_name = Column(String)
    materials_text = Column(Text)
    script = Column(Text)
    transcript = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# A lecture split into small passages. embedding is a JSON list of floats,
# or NULL when the embedding model was unavailable (keyword search is used then).
class LectureChunk(Base):

    __tablename__ = "lecture_chunks"
    id = Column(Integer, primary_key=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id"), index=True)
    source = Column(String)  # "materials" or "script"
    text = Column(Text)
    embedding = Column(Text)