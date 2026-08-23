from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from src.database import get_db
from src.models import Event, RSVP, Club
from src.middleware.pat_auth import verify_club_pat
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/v1/clubs", tags=["Club Developer Analytics"])

@router.get("/{club_id}/rsvps")
@limiter.limit("100/minute")
def export_club_rsvps(
    request: Request,
    club_id: int,
    authenticated_club: Club = Depends(verify_club_pat),
    db: Session = Depends(get_db)
):
    # Ensure token matches requested club scope
    if authenticated_club.id != club_id:
        raise HTTPException(status_code=403, detail="Token does not have access to this club's resources.")
    
    # Query all events and RSVPs for the club
    events = db.query(Event).filter(Event.club_id == club_id).all()
    event_ids = [e.id for e in events]
    
    rsvps = db.query(RSVP).filter(RSVP.event_id.in_(event_ids)).all()
    
    export_data = []
    for rsvp in rsvps:
        export_data.append({
            "event_id": rsvp.event_id,
            "event_title": rsvp.event.title,
            "student_id": rsvp.student_id,
            "student_email": rsvp.student.email,
            "status": rsvp.status,
            "registered_at": rsvp.created_at.isoformat()
        })
        
    return {
        "club_id": club_id,
        "total_records": len(export_data),
        "data": export_data
    }
