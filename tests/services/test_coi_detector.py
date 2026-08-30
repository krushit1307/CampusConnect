import pytest
import sqlite3
from app.services.election_manager import ElectionManager, BylawViolationException

@pytest.fixture
def mock_db():
    """Builds transient context database tables populated with seed data scenarios."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE clubs (
            id INTEGER PRIMARY KEY, title TEXT, tier INTEGER
        );
    """)
    cursor.execute("""
        CREATE TABLE club_roles (
            id INTEGER PRIMARY KEY, user_id INTEGER, club_id INTEGER, role TEXT, status TEXT
        );
    """)
    cursor.execute("""
        CREATE TABLE candidates (
            id INTEGER PRIMARY KEY, user_id INTEGER, club_id INTEGER, position TEXT
        );
    """)
    
    # Seed operational club profiles
    cursor.execute("INSERT INTO clubs VALUES (10, 'Finance Club', 1);")
    cursor.execute("INSERT INTO clubs VALUES (20, 'Accounting Club', 1);")
    cursor.execute("INSERT INTO clubs VALUES (30, 'Photography Club', 2);") # Tier 2 control
    conn.commit()
    yield conn
    conn.close()

def test_coi_blocks_simultaneous_tier_1_executive_roles(mock_db):
    """Scenario: User is a Tier 1 Executive and tries to run for another Tier 1 Executive role."""
    cursor = mock_db.cursor()
    # Alex is already President of the Finance Club (Tier 1)
    cursor.execute("INSERT INTO club_roles VALUES (1, 55, 10, 'President', 'active');")
    mock_db.commit()

    # Attempt running for Treasurer of Accounting Club (Tier 1)
    with pytest.raises(BylawViolationException) as exc_info:
        ElectionManager.validate_and_submit_candidacy(
            user_id=55, target_club_id=20, target_role="Treasurer", db_conn=mock_db
        )
        
    assert "Bylaw Violation: You cannot run for an Executive position here because you are already an Executive in the Finance Club." in str(exc_info.value)

def test_coi_allows_running_if_existing_role_is_tier_2(mock_db):
    """Scenario: User holds an executive position in a Tier 2 club and can run for a Tier 1 role."""
    cursor = mock_db.cursor()
    # User is President of Photography Club (Tier 2)
    cursor.execute("INSERT INTO club_roles VALUES (2, 77, 30, 'President', 'active');")
    mock_db.commit()

    response = ElectionManager.validate_and_submit_candidacy(
        user_id=77, target_club_id=20, target_role="Treasurer", db_conn=mock_db
    )
    assert response["status"] == "SUCCESS"
