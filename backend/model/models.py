from model.database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, inspect, text
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
    # Filled in by routes/lectures.py so a lecture can be found and watched again
    job_id = Column(String, index=True)  # also the lecture's key in the frontend URL
    status = Column(String)  # "generating" | "ready" | "failed"
    error = Column(Text)
    video_url = Column(String)
    slides = Column(Text)  # JSON, same shape as the /ai/upload response
    subtitles = Column(Text)  # JSON, same shape as the /ai/upload response


# A lecture split into small passages. embedding is a JSON list of floats,
# or NULL when the embedding model was unavailable (keyword search is used then).
class LectureChunk(Base):

    __tablename__ = "lecture_chunks"
    id = Column(Integer, primary_key=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id"), index=True)
    source = Column(String)  # "materials" or "script"
    text = Column(Text)
    embedding = Column(Text)


# One private note a user made on a lecture (a lecture can have many).
# lecture_key is the key the frontend uses for that lecture (Lecture.job_id,
# or "local:..." for older lectures that only exist in the browser).
class LectureNote(Base):

    __tablename__ = "lecture_notes"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    lecture_key = Column(String, index=True)
    content = Column(Text)
    video_time = Column(Float)  # seconds into the video when the note was started
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def add_missing_columns(engine):
    """
    create_all() makes new tables but never adds columns to existing ones,
    so a database created by an older version would be missing them.
    """
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name not in existing:
                    column_type = column.type.compile(dialect=engine.dialect)
                    connection.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {column.name} {column_type}'))