from datetime import datetime, timedelta
import sqlite3
from typing import Dict, List

class PenaltyProcessorJob:
    @staticmethod
    def process_no_show_penalties(db_conn: sqlite3.Connection) -> Dict[str, List[int]]:
        cursor = db_conn.cursor()
        now = datetime.utcnow().isoformat()
        
        penalized_users = []
        suspended_users = []

        # Find users marked as 'no-show' for an event, who had another overlapping RSVP commitment
        cursor.execute("""
            SELECT DISTINCT r1.user_id, r1.event_id 
            FROM rsvps r1
            JOIN events e1 ON r1.event_id = e1.id
            JOIN rsvps r2 ON r1.user_id = r2.user_id AND r1.event_id != r2.event_id
            JOIN events e2 ON r2.event_id = e2.id
            WHERE r1.status = 'no-show'
              AND e1.start_time < ? 
              AND MAX(datetime(e1.start_time), datetime(e2.start_time)) < MIN(
                  datetime(e1.start_time, '+' || e1.duration_minutes || ' minutes'),
                  datetime(e2.start_time, '+' || e2.duration_minutes || ' minutes')
              );
        """, (now,))
        
        violations = cursor.fetchall()
        
        for user_id, event_id in violations:
            # 1. Deduct 500 points inside the gamification ledger
            cursor.execute("""
                INSERT INTO gamification_ledger (user_id, points_delta, description, timestamp)
                VALUES (?, -500, '-500 Points: Double-Booking Penalty', ?);
            """, (user_id, now))
            
            # 2. Re-calculate current points balance checkpoint
            cursor.execute("SELECT SUM(points_delta) FROM gamification_ledger WHERE user_id = ?;", (user_id,))
            current_balance = cursor.fetchone()[0] or 0
            
            penalized_users.append(user_id)

            # 3. Enforce suspension threshold if deficit hits or passes -1000 bounds
            if current_balance <= -1000:
                suspended_until = (datetime.utcnow() + timedelta(days=14)).isoformat() # 2-week restriction
                cursor.execute(
                    "UPDATE users SET rsvp_suspended_until = ? WHERE id = ?;",
                    (suspended_until, user_id)
                )
                suspended_users.append(user_id)
                
        db_conn.commit()
        return {"penalized_user_ids": penalized_users, "suspended_user_ids": suspended_users}
