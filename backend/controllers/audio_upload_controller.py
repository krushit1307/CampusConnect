import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.services.audio_deepfake_detector import analyze_audio_noise_floor

router = APIRouter()

UPLOAD_DIR = "uploads/audio"
QUARANTINE_DIR = "uploads/quarantine"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(QUARANTINE_DIR, exist_ok=True)

@router.post("/upload-audio")
async def upload_audio_file(file: UploadFile = File(...)):
    temp_path = os.path.join(UPLOAD_DIR, file.filename)
    
    # Save incoming stream file locally
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Run spectrogram consistency pipeline checks
        analysis = analyze_audio_noise_floor(temp_path)
        
        if analysis["is_synthetic"]:
            quarantine_path = os.path.join(QUARANTINE_DIR, file.filename)
            shutil.move(temp_path, quarantine_path)
            
            return {
                "status": "QUARANTINED",
                "message": analysis["reason"],
                "confidence": analysis["confidence"]
            }
            
        return {
            "status": "APPROVED",
            "message": "Audio file verified safely against acoustic fraud frameworks."
        }
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Acoustic analysis failed: {str(e)}")
