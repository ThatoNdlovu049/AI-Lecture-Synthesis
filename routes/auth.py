from fastapi import APIRouter, status, HTTPException, Depends
from model.database import SessionLocal
from model.User import UserRequest
from sqlalchemy.orm import Session
from typing import Annotated
from model.models import User
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from datetime import timedelta, datetime, timezone
from jose import jwt, JWTError
import os
from dotenv import load_dotenv

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)
load_dotenv()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

SECRETE_KEY = os.environ["SECRETE_KEY"]
algorithm = os.environ["ALGORITHM"]

db_dependency = Annotated[Session, Depends(get_db)]
bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_bearer = OAuth2PasswordBearer(tokenUrl="/auth/login")


######Html pages

#####User authentication functions
def validate_user(email : str, password : str, db):
    user = db.query(User).filter(User.email == email.lower()).first()

    if user is None:
        return False

    if not bcrypt_context.verify(password, user.password):
        return False

    return user

def create_access_token(username : str, user_id : int, role : str, expires_delta : timedelta):
    expires = datetime.now(timezone.utc) + expires_delta
    encode = {
        "sub": username,
        "user_id": user_id,
        "role": role,
        "exp": expires
    }
    token = jwt.encode(encode, SECRETE_KEY, algorithm=algorithm)

    return token

async def get_current_user(token : Annotated[str, Depends(oauth2_bearer)]):
    try:
        payload = jwt.decode(token, SECRETE_KEY, algorithms=[algorithm])
        username = payload.get("sub")
        user_id = payload.get("user_id")
        role = payload.get("role")

        if username is None or user_id is None or role is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access_token")

        return {"username" : username, "user_id" : user_id, "role" : role}
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail=f"Invalids access token {str(e)}")

######Routes
@router.post("/register_user", status_code=status.HTTP_201_CREATED)
async def register_user(db : db_dependency, user_model : UserRequest):
    user = User(
        first_name = user_model.first_name,
        last_name = user_model.last_name,
        username= user_model.username,
        email = user_model.email.lower(),
        password=bcrypt_context.hash(user_model.password),
        role = user_model.role
    )
    db.add(user)
    db.commit()

@router.post("/login")
async def login_user(form : Annotated[OAuth2PasswordRequestForm, Depends()], db : db_dependency):
    user = validate_user(form.username, form.password, db)

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")

    token = create_access_token(user.username, user.id, user.role, timedelta(minutes=10))

    return {"access_token": token, "token_type": "bearer"}

