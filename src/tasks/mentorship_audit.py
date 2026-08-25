from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from src.database import get_db
from src.models import MentorshipSession, MentorshipOutcome, User
from src.services.email import send_email_notification

def audit_mentorship_outcomes():
    db: Session = next(get_db())
    
    # Target sessions that occurred exactly 6 months ago (+/- 1 day window)
    six_months_ago_start = datetime.utcnow() - timedelta(days=183)
    six_months_ago_end = datetime.utcnow() - timedelta(days=181)
    
    sessions = db.query(MentorshipSession).filter(
        MentorshipSession.session_date >= six_months_ago_start,
        MentorshipSession.session_date <= six_months_ago_end,
        MentorshipSession.survey_dispatched == False
    ).all()
    
    for session in sessions:
        # Create pending outcome tracking record
        outcome = MentorshipOutcome(
            session_id=session.id,
            student_id=session.student_id,
            alumni_id=session.alumni_id,
            survey_sent_at=datetime.utcnow()
        )
        db.add(outcome)
        session.survey_dispatched = True
        
        # Send automated survey email to student
        survey_link = f"https://campusconnect.edu/survey/mentorship/{session.id}"
        send_email_notification(
            to_email=session.student.email,
            subject="How did your mentorship session impact your career?",
            body=f"Hi {session.student.full_name},\n\nIt's been 6 months since your mentorship chat with {session.alumni.full_name}. Did this lead to an internship, job offer, or interview? Please let us know here: {survey_link}"
        )
    
    db.commit()
