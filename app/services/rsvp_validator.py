from datetime import datetime, timedelta
import sqlite3
from typing import Dict, Any

class DoubleBookingException(Exception):
    """Custom exception raised when a user is suspended due to negative points standing."""
    pass

class RSVPValidator:
    @staticmethod
    def check_and_create_rsvp(user_id: int, target_event_id: int, db_conn: sqlite3.Connection) -> Dict[str, Any]:
        cursor = db_conn.cursor()
        now = datetime.utcnow().isoformat()

        # 1. Enforce strict suspension barriers if the user's reputation index is locked
        cursor.execute("SELECT rsvp_suspended_until FROM users WHERE id = ?;", (user_id,))
        user_record = cursor.fetchone()
        if user_record and user_record[0] and user_record[0] > now:
            raise DoubleBookingException(
                f"RSVP Access Suspended: Your registration privileges are locked until {user_record[0]} "
                f"due to severe gamification point deficits from past double-booking penalties."
            )

        # 2. Fetch targeted event duration parameters
        cursor.execute("SELECT start_time, duration_minutes, title FROM events WHERE id = ?;", (target_event_id,))
        target_event = cursor.fetchone()
        if not target_event:
            raise ValueError("Target event configuration does not exist.")
        
        target_start_str, duration, target_title = target_event
        target_start = datetime.fromisoformat(target_start_str)
        target_end = target_start + timedelta(minutes=duration)

        # 3. Query existing commitments to capture temporal overlaps
        cursor.execute("""
            SELECT e.id, e.title, e.start_time, e.duration_minutes 
            FROM rsvps r
            JOIN events e ON r.event_id = e.id
            WHERE r.user_id = ? AND r.status = 'registered';
        """, (user_id,))
        
        warning_msg = None
        for _, title, start_str, dur_mins in cursor.fetchall():
            start = datetime.fromisoformat(start_str)
            end = start + timedelta(minutes=dur_mins)
            
            # Standard Interval Overlap Logic Check: Max(Start1, Start2) < Min(End1, End2)
            if max(target_start, start) < min(target_end, end):
                warning_msg = (
                    f"⚠️ Warning: You are double-booking this slot with '{title}'. "
                    f"If you no-show to either event, you will lose 500 points from your balance."
                )
                break # Warn on the first intersecting node found

        # 4. Save registration parameters safely
        cursor.execute(
            "INSERT INTO rsvps (user_id, event_id, status) VALUES (?, ?, 'registered');",
            (user_id, target_event_id)
        )
        db_conn.commit()

        return {
            "status": "SUCCESS",
            "message": "RSVP successfully processed.",
            "warning": warning_msg
        }
