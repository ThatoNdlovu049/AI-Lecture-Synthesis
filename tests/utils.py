import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from model.models import Base, User
from routes.auth import bcrypt_context
from fastapi.testclient import TestClient
from main import app

SQL_ALCHEMY_URL = "sqlite:///./testLectureSynthesis.db"

engine = create_engine(SQL_ALCHEMY_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def override_test_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

def override_get_current_user():
    return {"username": "thato", "user_id" : 1, "role": "admin"}

client = TestClient(app)

@pytest.fixture
def test_user():

    user = User(
        first_name = "thatotest",
        last_name = "ndlovutest",
        username = "thatokhunetest",
        email = "testthato@gmail.com",
        password = bcrypt_context.hash("password"),
        role = "admin"
    )
    db = TestingSessionLocal()

    db.add(user)
    db.commit()
    yield db
    with engine.connect() as connection:
        connection.execute(text("DELETE FROM users"))
        connection.commit()