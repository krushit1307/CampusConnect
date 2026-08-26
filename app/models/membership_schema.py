import sqlite3

def upgrade_membership_trial_schema(db_conn: sqlite3.Connection) -> None:
    """Appends structural trial columns to support top-of-funnel membership onboarding hooks."""
    cursor = db_conn.cursor()
    try:
        # Add configurable trial allowance window to membership tiers table
        cursor.execute("ALTER TABLE club_membership_tiers ADD COLUMN trial_days_allowed INTEGER DEFAULT 0;")
        
        # Add subscription tracking columns onto the main user registration map
        cursor.execute("ALTER TABLE user_club_memberships ADD COLUMN stripe_subscription_id TEXT NULL;")
        cursor.execute("ALTER TABLE user_club_memberships ADD COLUMN trial_ends_at TEXT NULL;")
        cursor.execute("ALTER TABLE user_club_memberships ADD COLUMN subscription_status TEXT DEFAULT 'ACTIVE';") # TRIAL, ACTIVE, CANCELLED
        
        db_conn.commit()
    except sqlite3.OperationalError:
        # Columns already exist in the schema context
        pass
