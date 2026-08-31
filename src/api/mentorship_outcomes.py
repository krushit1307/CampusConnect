from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/mentorship", tags=["Mentorship Outcomes"])

class OutcomeSubmission(BaseModel):
    outcome_type: str  # job_offer, internship, interview, none
    company_name: Optional[str] = None

@router.post("/survey/{session_id}")
def submit_mentorship_outcome(session_id: int, payload: OutcomeSubmission, db: Session = Depends(get_db)):
    outcome = db.query(MentorshipOutcome).filter(MentorshipOutcome.session_id == session_id).first()
    if not outcome:
        raise HTTPException(status_code=404, detail="Outcome survey record not found")
    
    outcome.outcome_type = payload.outcome_type
    outcome.company_name = payload.company_name
    outcome.responded_at = datetime.utcnow()
    outcome.is_verified = True
    
    # Check if alumni qualifies for "Career Maker" badge (e.g., >= 2 successful job/internship outcomes)
    if payload.outcome_type in ["job_offer", "internship"]:
        successful_count = db.query(MentorshipOutcome).filter(
            MentorshipOutcome.alumni_id == outcome.alumni_id,
            MentorshipOutcome.outcome_type.in_(["job_offer", "internship"]),
            MentorshipOutcome.is_verified == True
        ).count()
        
        if successful_count >= 2:
            alumni = db.query(User).filter(User.id == outcome.alumni_id).first()
            if alumni:
                alumni.has_career_maker_badge = True

    db.commit()
    return {"status": "success", "message": "Thank you for sharing your career milestone!"}
