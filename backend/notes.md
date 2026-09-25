FASTAPI Setup
-
Dependencies
-
- Python 3.9+
 
Setup
-
- cd backend
- create virtual environment
- Activate virtual environment: 
  - .\venv\Scripts\activate
- Install requirements from requirements.txt: 
  - pip install -r requirements.txt
- from backend, cd wav2lip and install requirements.txt
  - pip install -r requirements.txt

Activate fastapi server
-
- uvicorn main:app --reload 