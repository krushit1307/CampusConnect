-- Migration: Optimize club_members table with composite primary key
-- This migration removes the surrogate UUID id column and replaces it with a composite primary key (club_id, user_id)

-- Step 1: Detect and report any duplicate rows before proceeding
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT club_id, user_id, COUNT(*)
        FROM club_members
        GROUP BY club_id, user_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate club_members rows. Removing duplicates keeping the most recent.', duplicate_count;
    ELSE
        RAISE NOTICE 'No duplicate club_members rows found.';
    END IF;
END $$;

-- Step 2: Remove duplicate rows, keeping the most recent one (based on joined_at)
DELETE FROM club_members
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY club_id, user_id ORDER BY joined_at DESC) as rn
        FROM club_members
    ) ranked
    WHERE rn > 1
);

-- Step 3: Drop existing indexes that reference the id column
DROP INDEX IF EXISTS idx_club_members_club_id;
DROP INDEX IF EXISTS idx_club_members_user_id;

-- Step 3.5: Drop dependent views that reference club_members.id column
DROP VIEW IF EXISTS public.club_recent_activity_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.club_analytics_mat_view CASCADE;

-- Step 4: Remove the id column primary key constraint
ALTER TABLE club_members DROP CONSTRAINT club_members_pkey;

-- Step 5: Remove the id column (and its default)
ALTER TABLE club_members ALTER COLUMN id DROP DEFAULT;
ALTER TABLE club_members DROP COLUMN id;

-- Step 6: Create composite primary key on (club_id, user_id)
ALTER TABLE club_members ADD PRIMARY KEY (club_id, user_id);

-- Step 7: Recreate indexes for the composite key
-- Note: The composite primary key automatically creates an index, but we keep explicit indexes for query optimization
CREATE INDEX idx_club_members_club_id ON club_members(club_id);
CREATE INDEX idx_club_members_user_id ON club_members(user_id);
CREATE INDEX idx_club_members_status ON club_members(status);

-- Step 8: Update the trigger function that assigns default roles
-- The trigger function needs to handle the new schema without id column
CREATE OR REPLACE FUNCTION public.assign_default_club_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id IS NULL THEN
    SELECT id INTO NEW.role_id
    FROM public.club_roles
    WHERE club_id = NEW.club_id AND title = 'Member'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8.5: Recreate the views using user_id instead of id
CREATE MATERIALIZED VIEW public.club_analytics_mat_view AS
SELECT 
    c.id AS club_id,
    c.name AS club_name,
    COUNT(DISTINCT cm.user_id) AS total_members,
    COUNT(DISTINCT e.id) AS total_events
FROM 
    public.clubs c
LEFT JOIN 
    public.club_members cm ON c.id = cm.club_id AND cm.status = 'approved'
LEFT JOIN 
    public.events e ON c.id = e.club_id
GROUP BY 
    c.id, c.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_analytics_mat_view_club_id ON public.club_analytics_mat_view(club_id);
GRANT SELECT ON public.club_analytics_mat_view TO authenticated, anon;

CREATE OR REPLACE VIEW public.club_recent_activity_metrics AS
SELECT 
    c.id AS club_id,
    c.name AS club_name,
    COUNT(DISTINCT p.id) AS recent_posts_count,
    COUNT(DISTINCT cm.user_id) AS recent_approvals_count,
    COUNT(DISTINCT er.id) AS recent_rsvps_count
FROM public.clubs c
LEFT JOIN public.posts p 
    ON p.club_id = c.id 
    AND p.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN public.club_members cm 
    ON cm.club_id = c.id 
    AND cm.status = 'approved' 
    AND cm.joined_at >= NOW() - INTERVAL '30 days'
LEFT JOIN public.events e 
    ON e.club_id = c.id
LEFT JOIN public.event_rsvps er 
    ON er.event_id = e.id 
    AND er.rsvp_at >= NOW() - INTERVAL '30 days'
GROUP BY c.id, c.name;

GRANT SELECT ON public.club_recent_activity_metrics TO authenticated;

-- Step 9: Verify the migration
DO $$
DECLARE
    table_count INTEGER;
    pk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count FROM club_members;
    SELECT COUNT(*) INTO pk_count FROM pg_constraint 
    WHERE conname = 'club_members_pkey' AND conrelid = 'club_members'::regclass;
    
    RAISE NOTICE 'Migration complete. club_members has % rows with composite primary key.', table_count;
    IF pk_count = 1 THEN
        RAISE NOTICE 'Composite primary key successfully created.';
    ELSE
        RAISE EXCEPTION 'Primary key verification failed.';
    END IF;
END $$;
