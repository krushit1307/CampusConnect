import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, List

class ClubVitalityAuditor:
    def __init__(self, db_conn: sqlite3.Connection, email_service: Any):
        self.db = db_conn
        self.email = email_service

    def audit_club_vitality(self) -> Dict[str, List[int]]:
        """
        Cron Job: Scans for dead clubs, sends warnings, and auto-archives 
        clubs that ignored warnings after 30 days.
        """
        cursor = self.db.cursor()
        now = datetime.utcnow()
        one_year_ago = (now - timedelta(days=365)).isoformat()
        thirty_days_ago = (now - timedelta(days=30)).isoformat()

        processed_warnings = []
        processed_archivals = []

        # --- PHASE 1: Send Warnings to Inactive Clubs ---
        # Find active clubs with zero events, ledger transactions, or roster modifications in 365 days
        cursor.execute(f"""
            SELECT c.id, c.title, c.president_email 
            FROM clubs c
            WHERE c.status = 'active'
              AND c.id NOT IN (SELECT club_id FROM events WHERE created_at > '{one_year_ago}')
              AND c.id NOT IN (SELECT club_id FROM ledger_transactions WHERE timestamp > '{one_year_ago}')
              AND c.id NOT IN (SELECT club_id FROM member_updates WHERE timestamp > '{one_year_ago}')
              AND c.warning_sent_at IS NULL;
        """)
        
        inactive_clubs = cursor.fetchall()
        for club_id, title, president_email in inactive_clubs:
            # Dispatch "Final Warning" alerting text message infrastructure
            self.email.send_warning(
                to=president_email,
                subject=f"⚠️ Action Required: Inactivity Warning for {title}",
                body=f"Your club is marked as inactive. Host an event within 30 days or you will be automatically decertified."
            )
            cursor.execute(
                "UPDATE clubs SET warning_sent_at = ? WHERE id = ?;", 
                (now.isoformat(), club_id)
            )
            processed_warnings.append(club_id)

        # --- PHASE 2: Archive Warned Clubs with No Action ---
        # Find clubs flagged > 30 days ago that still haven't produced any activity indicators
        cursor.execute(f"""
            SELECT c.id FROM clubs c
            WHERE c.status = 'active'
              AND c.warning_sent_at < '{thirty_days_ago}'
              AND c.id NOT IN (SELECT club_id FROM events WHERE created_at > c.warning_sent_at)
              AND c.id NOT IN (SELECT club_id FROM ledger_transactions WHERE timestamp > c.warning_sent_at)
              AND c.id NOT IN (SELECT club_id FROM member_updates WHERE timestamp > c.warning_sent_at);
        """)
        
        clubs_to_archive = [row[0] for row in cursor.fetchall()]
        for club_id in clubs_to_archive:
            cursor.execute("UPDATE clubs SET status = 'archived' WHERE id = ?;", (club_id,))
            processed_archivals.append(club_id)

        self.db.commit()
        return {"warnings_issued": processed_warnings, "clubs_archived": processed_archivals}
