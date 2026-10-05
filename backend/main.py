from fastapi import FastAPI, status
from model.database import engine
from model.models import Base
from routes import auth, ai, user
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os


app = FastAPI()
Base.metadata.create_all(bind=engine)

WAV2LIP_DIR = os.path.join(os.path.dirname(__file__), "Wav2Lip")
os.makedirs(os.path.join(WAV2LIP_DIR, "results"), exist_ok=True)

app.mount("/results", StaticFiles(directory=os.path.join(WAV2LIP_DIR, "results")), name="results")

# Slide images generated from the uploaded materials (see routes/ai.py)
# are saved under backend/output/slides/<id>/page_N.png - this exposes
# that folder at /slides/... so the frontend can load them as <img src>.
SLIDES_DIR = os.path.join(os.path.dirname(__file__), "output", "slides")
os.makedirs(SLIDES_DIR, exist_ok=True)
app.mount("/slides", StaticFiles(directory=SLIDES_DIR), name="slides")
@app.get("/health_check", status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "healthy!"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(user.router)