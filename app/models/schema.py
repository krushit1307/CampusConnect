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
