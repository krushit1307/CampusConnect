from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.database import get_db
from src.models import Event, Venue

router = APIRouter(prefix="/api/events", tags=["Event Auto-Scaler"])

@router.post("/{event_id}/upgrade-venue")
def upgrade_event_venue(event_id: int, venue_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    new_venue = db.query(Venue).filter(Venue.id == venue_id).first()
    if not new_venue:
        raise HTTPException(status_code=404, detail="Target venue not found")
    
    event.venue_id = new_venue.id
    db.commit()
    
    return {"status": "success", "message": f"Successfully upgraded event venue to {new_venue.name}!"}
