import sqlite3
from typing import Dict, Any

class BylawViolationException(Exception):
    """Custom exception raised when a candidate breaches systemic governance rules."""
    pass

class ElectionManager:
    @staticmethod
    def validate_and_submit_candidacy(
        user_id: int, 
        target_club_id: int, 
        target_role: str, 
        db_conn: sqlite3.Connection
    ) -> Dict[str, Any]:
        cursor = db_conn.cursor()
        
        # Define target governance tiers and restricted executive roles
        EXECUTIVE_ROLES = {"President", "Vice President", "Treasurer", "Secretary"}
        
        if target_role not in EXECUTIVE_ROLES:
            # Skip rule checks if the role is non-executive (e.g., standard member/volunteer)
            return ElectionManager._persist_candidacy(user_id, target_club_id, target_role, db_conn)

        # 1. Fetch the operational tier of the target club
        cursor.execute("SELECT title, tier FROM clubs WHERE id = ?;", (target_club_id,))
        target_club = cursor.fetchone()
        if not target_club:
            raise ValueError("Target club configuration does not exist.")
            
        target_club_title, target_club_tier = target_club

        # 2. If the target club is Tier 1, cross-reference user's active global roles
        if target_club_tier == 1:
            cursor.execute("""
                SELECT c.title 
                FROM club_roles cr
                JOIN clubs c ON cr.club_id = c.id
                WHERE cr.user_id = ? 
                  AND cr.role IN ('President', 'Vice President', 'Treasurer', 'Secretary')
                  AND c.tier = 1 
                  AND cr.status = 'active';
            """, (user_id,))
            
            existing_violation = cursor.fetchone()
            
            # 3. Trigger immediate rejection if a conflicting Tier 1 role is found
            if existing_violation:
                conflicting_club_title = existing_violation[0]
                raise BylawViolationException(
                    f"Bylaw Violation: You cannot run for an Executive position here "
                    f"because you are already an Executive in the {conflicting_club_title}."
                )

        return ElectionManager._persist_candidacy(user_id, target_club_id, target_role, db_conn)

    @staticmethod
    def _persist_candidacy(user_id: int, club_id: int, role: str, db_conn: sqlite3.Connection) -> Dict[str, Any]:
        cursor = db_conn.cursor()
        cursor.execute(
            "INSERT INTO candidates (user_id, club_id, position) VALUES (?, ?, ?);",
            (user_id, club_id, role)
        )
        db_conn.commit()
        return {"status": "SUCCESS", "message": "Candidacy successfully registered."}
