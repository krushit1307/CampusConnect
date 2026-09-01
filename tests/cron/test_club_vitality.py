import pytest
import sqlite3
from datetime import datetime, timedelta
from unittest.mock import MagicMock
from app.cron.club_vitality_job import ClubVitalityAuditor

@pytest.fixture
def mock_db():
    """Initializes a sandboxed in-memory database configuration mimicking standard operational states."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE clubs (
            id INTEGER PRIMARY KEY, title TEXT, president_email TEXT, status TEXT, warning_sent_at TEXT
        );
    """)
    cursor.execute("CREATE TABLE events (id INTEGER PRIMARY KEY, club_id INTEGER, created_at TEXT);")
    cursor.execute("CREATE TABLE ledger_transactions (id INTEGER PRIMARY KEY, club_id INTEGER, timestamp TEXT);")
    cursor.execute("CREATE TABLE member_updates (id INTEGER PRIMARY KEY, club_id INTEGER, timestamp TEXT);")
    conn.commit()
    yield conn
    conn.close()

def test_warning_issued_to_completely_inactive_club(mock_db):
    """Scenario: Active club with no vital metrics for 365 days receives a final warning email."""
    cursor = mock_db.cursor()
    cursor.execute("INSERT INTO clubs VALUES (1, 'Chess Dead Club', 'pres@chess.edu', 'active', NULL);")
    mock_db.commit()

    mock_email = MagicMock()
    auditor = ClubVitalityAuditor(mock_db, mock_email)
    
    results = auditor.audit_club_vitality()
    
    assert 1 in results["warnings_issued"]
    mock_email.send_warning.assert_called_once_with(
        to="pres@chess.edu",
        subject="⚠️ Action Required: Inactivity Warning for Chess Dead Club",
        body="Your club is marked as inactive. Host an event within 30 days or you will be automatically decertified."
    )

def test_club_archived_after_30_days_of_continued_inactivity(mock_db):
    """Scenario: Warned club fails to produce actions within 30 days and gets archived."""
    cursor = mock_db.cursor()
    overdue_warning_date = (datetime.utcnow() - timedelta(days=31)).isoformat()
    cursor.execute(
        "INSERT INTO clubs VALUES (2, 'Ghost Club', 'pres@ghost.edu', 'active', ?);", 
        (overdue_warning_date,)
    )
    mock_db.commit()

    mock_email = MagicMock()
    auditor = ClubVitalityAuditor(mock_db, mock_email)
    
    results = auditor.audit_club_vitality()
    
    assert 2 in results["clubs_archived"]
    cursor.execute("SELECT status FROM clubs WHERE id = 2;")
    assert cursor.fetchone()[0] == "archived"
