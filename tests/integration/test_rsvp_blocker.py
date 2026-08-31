import pytest
import sqlite3
from app.services.rsvp_manager import RSVPManager, PrerequisiteException

@pytest.fixture
def mock_db():
    """Builds transient context database tables populated with seed data scenarios."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE events (
            id INTEGER PRIMARY KEY, title TEXT, formatted_date TEXT, prerequisite_event_id INTEGER
        );
    """)
    cursor.execute("CREATE TABLE rsvps (id INTEGER PRIMARY KEY, user_id INTEGER, event_id INTEGER, status TEXT);")
    
    # Seed standard course sequence tracking rows
    cursor.execute("INSERT INTO events VALUES (101, 'Intro to React', 'Oct 12th', NULL);")
    cursor.execute("INSERT INTO events VALUES (202, 'Advanced React', 'Nov 15th', 101);")
    conn.commit()
    yield conn
    conn.close()

def test_eligible_user_rsvp_success(mock_db):
    """Scenario: User attended the prerequisite event and can successfully RSVP."""
    cursor = mock_db.cursor()
    cursor.execute("INSERT INTO rsvps (user_id, event_id, status) VALUES (99, 101, 'attended');")
    mock_db.commit()
    
    response = RSVPManager.validate_and_create_rsvp(user_id=99, event_id=202, db_conn=mock_db)
    assert response["status"] == "SUCCESS"

def test_unqualified_user_rsvp_blocked(mock_db):
    """Scenario: User did not attend the prerequisite event and gets blocked with a clear warning."""
    with pytest.raises(PrerequisiteException) as exc_info:
        RSVPManager.validate_and_create_rsvp(user_id=45, event_id=202, db_conn=mock_db)
        
    assert "You cannot register for 'Advanced React'. You must first attend 'Intro to React' on Oct 12th." in str(exc_info.value)
