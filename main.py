from fastapi import FastAPI, status
from model.database import engine
from model.models import Base
from routes import auth


app = FastAPI()
Base.metadata.create_all(bind=engine)


@app.get("/health_check", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "healthy!"}

app.include_router(auth.router)