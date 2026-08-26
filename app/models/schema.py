import sqlite3
from typing import Dict, Any, Optional

def upgrade_events_schema(db_conn: sqlite3.Connection) -> None:
    """Appends structural tracking columns to validate workshop sequence restrictions."""
    cursor = db_conn.cursor()
    try:
        cursor.execute("ALTER TABLE events ADD COLUMN prerequisite_event_id INTEGER REFERENCES events(id);")
        db_conn.commit()
    except sqlite3.OperationalError:
        # Gracefully handle scenarios where the column index allocation already exists
        pass
 feature/double-booking-penalty-4045
 feature/double-booking-penalty-4045

 feature/membership-trial-period-4406
 main

def upgrade_double_booking_schema(db_conn: sqlite3.Connection) -> None:
    """Appends structural tracking columns to support double-booking penalties and suspensions."""
    cursor = db_conn.cursor()
    try:
        # Track start time and duration to compute temporal overlaps accurately
        cursor.execute("ALTER TABLE events ADD COLUMN start_time TEXT;")  # ISO 8601 Format
        cursor.execute("ALTER TABLE events ADD COLUMN duration_minutes INTEGER DEFAULT 60;")
        
        # Track user standing points and lock status inside the gamification/rsvp framework
        cursor.execute("ALTER TABLE users ADD COLUMN rsvp_suspended_until TEXT NULL;")
        db_conn.commit()
    except sqlite3.OperationalError:
        # Columns already exist in the schema state
        pass

 main
