from starlette import status
from tests.utils import *
from routes.auth import get_current_user, get_db, create_access_token, SECRETE_KEY, algorithm, validate_user
import pytest
from datetime import timedelta
from jose import jwt

app.dependency_overrides[get_db] = override_test_db

@pytest.mark.asyncio
def test_create_user(test_user):
    user = {
        "first_name" : "thatotest2",
        "last_name" : "ndlovutest2",
        "username" : "thatokhunetest2",
        "email" : "testthato23545523@gmail.com",
        "password" : bcrypt_context.hash("password"),
        "role" : "user"
    }
    response = client.post("/auth/register_user", json=user)
    assert response.status_code == status.HTTP_201_CREATED

    db = TestingSessionLocal()

    user_model = db.query(User).filter(User.id == 2).first()

    assert user_model.first_name == user.get("first_name")
    assert user_model.last_name == user.get("last_name")
    assert user_model.username == user.get("username")
    assert user_model.email == user.get("email")
    assert user_model.role == user.get("role")

@pytest.mark.asyncio
def test_create_user_invalid(test_user):
    user = {
        "first_name" : "",
        "last_name": "",
        "username": "thatokhunetest2",
        "email": "testthato23545523@gmail.com",
        "password": bcrypt_context.hash("password"),
        "role": "user"
    }
    response = client.post("/auth/register_user", json=user)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
def test_create_access_token():

    token = create_access_token("thatotest", 1, "admin", timedelta(minutes=10))

    payload = jwt.decode(token, SECRETE_KEY, algorithms=algorithm)

    assert payload.get("sub") == "thatotest"
    assert payload.get("user_id") == 1
    assert payload.get("role") == "admin"

@pytest.mark.asyncio
def test_validate_user(test_user):

    db = TestingSessionLocal()

    user = validate_user("testthato@gmail.com", "password", db)

    assert user.first_name == "thatotest"
    assert user.last_name == "ndlovutest"

    invalid_user = validate_user("", "password", db)
    assert invalid_user == False

    invalid_password = validate_user("testthato@gmail.com", "ppasswordReload", db)
    assert invalid_password == False

@pytest.mark.asyncio
async def test_get_current_user():
    encode = {
        "sub": "testUser",
        "user_id": 1,
        "role": "admin"
    }
    token = jwt.encode(encode, SECRETE_KEY, algorithm=algorithm)
    user = await get_current_user(token)
    assert user == {
        "username": "testUser",
        "user_id": 1,
        "role": "admin"
    }