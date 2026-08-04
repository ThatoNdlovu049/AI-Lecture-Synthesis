from fastapi import APIRouter, status, HTTPException, Depends
from model.database import SessionLocal
from model.User import UserRequest
from sqlalchemy.orm import Session
from typing import Annotated
from model.models import User
from passlib.context import CryptContext

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

######Html pages

######Routes
@router.post("/register_user", status_code=status.HTTP_201_CREATED)
async def register_user(db : db_dependency, user_model : UserRequest):
    user = User(
        first_name = user_model.first_name,
        last_name = user_model.last_name,
        email = user_model.email,
        password=bcrypt_context.hash(user_model.password),
        role = user_model.role
    )
    db.add(user)
    db.commit()

@router.get("/get_all_users", status_code=status.HTTP_200_OK)
async def get_all_users(db : db_dependency):
    users = db.query(User).all()

    if not users:
        raise HTTPException(status_code=404, detail="No users found")

    return users