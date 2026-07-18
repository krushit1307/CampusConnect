-- ============================================================
-- Migration: 20260716000008_club_membership_uniqueness.sql
-- Description:
-- Verify and preserve uniqueness for club membership requests.
-- The existing UNIQUE(club_id, user_id) constraint already
-- prevents duplicate applications. Since the table does not
-- implement soft deletes, no partial unique index is required.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'club_members'::regclass
          AND contype = 'u'
          AND conkey = ARRAY[
              (SELECT attnum FROM pg_attribute
               WHERE attrelid = 'club_members'::regclass
                 AND attname = 'club_id'),
              (SELECT attnum FROM pg_attribute
               WHERE attrelid = 'club_members'::regclass
                 AND attname = 'user_id')
          ]
    ) THEN
        ALTER TABLE club_members
        ADD CONSTRAINT club_members_club_id_user_id_key
        UNIQUE (club_id, user_id);
    END IF;
END $$;