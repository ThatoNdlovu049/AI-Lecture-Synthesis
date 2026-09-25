from fastapi import APIRouter, Depends, HTTPException, status
from routes.auth import get_current_user
from typing import Annotated
from model.database import SessionLocal
from sqlalchemy.orm import Session
from model.models import User

router = APIRouter(
    prefix="/user",
    tags=["user"]
)



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
user_dependency = Annotated[dict, Depends(get_current_user)]

@router.get("/logged-in", status_code=status.HTTP_200_OK)
async def user_logged_in(user : user_dependency, db: db_dependency):

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not authorized")

    user_id = user.get("user_id")

    return db.query(User).filter(User.id == user_id).first()


