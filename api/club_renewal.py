from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from datetime import datetime
from src.database import get_db
from src.models import Club, ClubRole, User
from src.utils.mime_validator import validate_mime_type

router = APIRouter(prefix="/api/clubs", tags=["Club Renewal"])

@router.get("/{club_id}/renewal-status")
def get_renewal_status(club_id: int, db: Session = Depends(get_db)):
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    
    # Check if current date is past May 1st of the active academic year and not yet certified for 2026
    current_year = datetime.utcnow().year
    is_after_may_first = datetime.utcnow().month >= 5
    
    if is_after_may_first and club.certification_year < current_year:
        club.is_locked_for_renewal = True
        db.commit()

    return {
        "club_id": club.id,
        "name": club.name,
        "certification_year": club.certification_year,
        "is_locked": club.is_locked_for_renewal,
        "constitution_submitted": bool(club.constitution_url),
        "balance_reconciled": club.balance == 0.0,
    }

@router.post("/{club_id}/submit-renewal")
async def submit_club_renewal(
    club_id: int,
    new_president_id: int = Form(...),
    constitution_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    club = db.query(Club).filter(Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")

    # Step 1: Validate Constitution PDF MIME & Magic Bytes
    file_bytes = await constitution_file.read()
    if not validate_mime_type(file_bytes, constitution_file.filename):
        raise HTTPException(status_code=400, detail="Invalid constitution file. Must be a verified PDF.")

    # Step 2: Verify Financial Reconciliation ($0 balance or rolled over)
    if club.balance != 0.0:
        raise HTTPException(status_code=400, detail="Club balance must be reconciled or rolled over to $0 before renewal.")

    # Step 3: Reassign President Role to Successor
    new_president = db.query(User).filter(User.id == new_president_id).first()
    if not new_president:
        raise HTTPException(status_code=404, detail="Designated successor user not found.")
    
    current_president_role = db.query(ClubRole).filter(ClubRole.club_id == club_id, ClubRole.title == "President").first()
    if current_president_role:
        current_president_role.user_id = new_president.id

    # Unlock club and update certification year
    club.constitution_url = f"/uploads/constitutions/{club_id}_{constitution_file.filename}"
    club.certification_year = datetime.utcnow().year
    club.is_locked_for_renewal = False
    
    db.commit()
    return {"status": "success", "message": "Club successfully renewed for the new academic year!"}
