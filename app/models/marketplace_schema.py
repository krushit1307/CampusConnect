import sqlite3

def upgrade_marketplace_schema(db_conn: sqlite3.Connection) -> None:
    """Appends relational infrastructure to support internal gig bounties and escrow states."""
    cursor = db_conn.cursor()
    try:
        # Core Bounties Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gig_bounties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                club_id INTEGER NOT NULL,
                event_id INTEGER,
                description TEXT NOT NULL,
                payout_amount REAL NOT NULL,
                status TEXT DEFAULT 'OPEN', -- OPEN, FILLED, CANCELLED
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Draft Submissions Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gig_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bounty_id INTEGER NOT NULL,
                student_id INTEGER NOT NULL,
                watermarked_url TEXT NOT NULL,
                high_res_url TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED
                FOREIGN KEY(bounty_id) REFERENCES gig_bounties(id)
            );
        """)
        
        # User Balances for Stripe Connect cashouts
        cursor.execute("""
            ALTER TABLE users ADD COLUMN stripe_balance REAL DEFAULT 0.0;
        """)
        
        db_conn.commit()
    except sqlite3.OperationalError:
        # Schema elements already exist in the database state
        pass
