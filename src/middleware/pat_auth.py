from fastapi import Security, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import bcrypt
from datetime import datetime
from src.database import get_db
from src.models import ClubApiToken, Club

security = HTTPBearer()

def verify_club_pat(credentials: HTTPAuthorizationCredentials = Security(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    
    # Query all active club tokens (or optimize prefix lookup if required)
    tokens = db.query(ClubApiToken).all()
    
    matched_token_record = None
    for token_record in tokens:
        if bcrypt.checkpw(token.encode('utf-8'), token_record.token_hash.encode('utf-8')):
            matched_token_record = token_record
            break
            
    if not matched_token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Personal Access Token",
        )
    
    # Update last used timestamp
    matched_token_record.last_used_at = datetime.utcnow()
    db.commit()
    
    club = db.query(Club).filter(Club.id == matched_token_record.club_id).first()
    return club
