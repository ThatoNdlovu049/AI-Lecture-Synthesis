from pydantic import BaseModel, Field

class UserRequest(BaseModel):
    first_name: str = Field(min_length = 3)
    last_name : str = Field(min_length = 3)
    username : str = Field(min_length = 3)
    email : str = Field(min_length = 3, max_length=150)
    password : str = Field(min_length = 3)
    role : str = Field(default="user")