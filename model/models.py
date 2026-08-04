from model.database import Base
from sqlalchemy import Column, Integer, String


class User(Base):

    __tablename__ = "users"
    id = Column(Integer, primary_key=True, unique=True)
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String, unique=True)
    password = Column(String)
    role = Column(String)