class PrerequisiteException(Exception):
    """Custom exception raised when a user bypasses workshop sequencing structures."""
    pass

class RSVPManager:
    @staticmethod
    def validate_and_create_rsvp(user_id: int, event_id: int, db_conn: sqlite3.Connection) -> Dict[str, Any]:
        cursor = db_conn.cursor()
        
        # 1. Fetch targeted event configuration profile details
        cursor.execute(
            "SELECT id, title, prerequisite_event_id FROM events WHERE id = ?;", 
            (event_id,)
        )
        target_event = cursor.fetchone()
        if not target_event:
            raise ValueError("Target event configuration does not exist.")
            
        event_title = target_event[1]
        prereq_id = target_event[2]
        
        # 2. Evaluate if sequence dependencies exist
        if prereq_id:
            cursor.execute(
                "SELECT title, formatted_date FROM events WHERE id = ?;", 
                (prereq_id,)
            )
            prereq_event = cursor.fetchone()
            prereq_title = prereq_event[0]
            prereq_date = prereq_event[1]
            
            # 3. Query the RSVPs matrix to audit historical participation
            cursor.execute(
                """
                SELECT id FROM rsvps 
                WHERE user_id = ? AND event_id = ? AND status = 'attended';
                """,
                (user_id, prereq_id)
            )
            attendance_record = cursor.fetchone()
            
            # 4. Enforce strict blocker validation criteria if no record exists
            if not attendance_record:
                raise PrerequisiteException(
                    f"You cannot register for '{event_title}'. "
                    f"You must first attend '{prereq_title}' on {prereq_date}."
                )
                
        # 5. Commit registration safely once criteria are cleared
        cursor.execute(
            "INSERT INTO rsvps (user_id, event_id, status) VALUES (?, ?, 'registered');",
            (user_id, event_id)
        )
        db_conn.commit()
        return {"status": "SUCCESS", "message": "RSVP successfully processed."}
