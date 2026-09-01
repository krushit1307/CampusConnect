import pytest
import sqlite3
from datetime import datetime, timedelta
from app.services.rsvp_validator import RSVPValidator, DoubleBookingException
from app.cron.penalty_processor_job import PenaltyProcessorJob

@pytest.fixture
def mock_event_db():
    """Builds transient database tables pre-populated with overlapping event test scenarios."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, rsvp_suspended_until TEXT);")
    cursor.execute("CREATE TABLE events (id INTEGER PRIMARY KEY, title TEXT, start_time TEXT, duration_minutes INTEGER);")
    cursor.execute("CREATE TABLE rsvps (user_id INTEGER, event_id INTEGER, status TEXT);")
    cursor.execute("CREATE TABLE gamification_ledger (user_id INTEGER, points_delta INTEGER, description TEXT, timestamp TEXT);")
    
    # Seed overlapping Friday night slots: 7:00 PM (duration 60 mins)
    cursor.execute("INSERT INTO events VALUES (1, 'Advanced React Dev Workshop', '2026-08-28T19:00:00', 60);")
    cursor.execute("INSERT INTO events VALUES (2, 'Finance Club Mixer Panel', '2026-08-28T19:30:00', 60);") # Overlaps React
    conn.commit()
    yield conn
    conn.close()

def test_double_booking_flow_triggers_warning_alert(mock_event_db):
    """Scenario: User has an active reservation and attempts to sign up for an overlapping event slot."""
    # User 12 registers for React first
    RSVPValidator.check_and_create_rsvp(user_id=12, target_event_id=1, db_conn=mock_event_db)
    
    # User 12 attempts to book overlapping Finance mixer
    result = RSVPValidator.check_and_create_rsvp(user_id=12, target_event_id=2, db_conn=mock_event_db)
    
    assert result["status"] == "SUCCESS"
    assert "You are double-booking" in result["warning"]
    assert "lose 500 points" in result["warning"]

def test_cron_job_applies_points_penalty_and_suspension(mock_event_db):
    """Scenario: Double-booked user flaked out on a commitment. Verify deduction and suspension rules apply."""
    cursor = mock_event_db.cursor()
    # Pre-seed User 40 as registered for both, but marked 'no-show' on event 1 after execution window
    cursor.execute("INSERT INTO rsvps VALUES (40, 1, 'no-show');")
    cursor.execute("INSERT INTO rsvps VALUES (40, 2, 'attended');")
    
    # Intentionally trigger an existing deficit balance to test suspension thresholds (-500 baseline)
    cursor.execute("INSERT INTO gamification_ledger VALUES (40, -500, 'Prior penalty', '2026-08-20T12:00:00');")
    mock_event_db.commit()

    # Trigger post-event processing script execution
    report = PenaltyProcessorJob.process_no_show_penalties(mock_event_db)
    
    assert 40 in report["penalized_user_ids"]
    assert 40 in report["suspended_user_ids"] # Total hit -1000 points, triggering suspension

    # Verify user's reservation capabilities throw suspension traps
    with pytest.raises(DoubleBookingException, match="RSVP Access Suspended"):
        RSVPValidator.check_and_create_rsvp(user_id=40, target_event_id=1, db_conn=mock_event_db)
