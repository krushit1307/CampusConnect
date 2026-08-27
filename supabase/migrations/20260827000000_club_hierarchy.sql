-- 1. Add parent_club_id
ALTER TABLE clubs
ADD COLUMN parent_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- 2. Index for fast hierarchy lookups
CREATE INDEX idx_clubs_parent_club_id
ON clubs(parent_club_id);

-- 3. Trigger function to prevent circular relationships
CREATE OR REPLACE FUNCTION public.prevent_club_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_parent UUID;
BEGIN
    -- Top-level club, no parent
    IF NEW.parent_club_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Self-referencing check
    IF NEW.parent_club_id = NEW.id THEN
        RAISE EXCEPTION 'A club cannot be its own parent';
    END IF;

    current_parent := NEW.parent_club_id;

    -- Walk up the tree to check for cycles
    WHILE current_parent IS NOT NULL LOOP
        IF current_parent = NEW.id THEN
            RAISE EXCEPTION 'Circular club hierarchy detected';
        END IF;

        SELECT parent_club_id
        INTO current_parent
        FROM clubs
        WHERE id = current_parent;
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_club_cycle
BEFORE INSERT OR UPDATE OF parent_club_id
ON clubs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_club_cycle();

-- 4. Recursive view exposing the tree
CREATE OR REPLACE VIEW public.club_hierarchy_view WITH (security_invoker = true) AS
WITH RECURSIVE club_tree AS (
    -- Base case: Top level clubs
    SELECT
        c.id,
        c.name,
        c.logo_url,
        c.parent_club_id,
        president.full_name AS president_name,
        0 AS depth,
        ARRAY[c.id] AS path
    FROM clubs c
    LEFT JOIN club_members cm
        ON cm.club_id = c.id
       AND cm.role = 'owner' -- assuming 'owner' is the president role in CampusConnect
    LEFT JOIN profiles president
        ON president.id = cm.user_id
    WHERE c.parent_club_id IS NULL

    UNION ALL

    -- Recursive step: Child clubs
    SELECT
        child.id,
        child.name,
        child.logo_url,
        child.parent_club_id,
        president.full_name AS president_name,
        parent.depth + 1,
        parent.path || child.id
    FROM clubs child
    INNER JOIN club_tree parent
        ON child.parent_club_id = parent.id
    LEFT JOIN club_members cm
        ON cm.club_id = child.id
       AND cm.role = 'owner'
    LEFT JOIN profiles president
        ON president.id = cm.user_id
    WHERE NOT child.id = ANY(parent.path)
)
SELECT
    id,
    name,
    logo_url,
    parent_club_id,
    president_name,
    depth
FROM club_tree;

-- Grant permissions (RLS will still apply via security_invoker = true)
GRANT SELECT ON public.club_hierarchy_view TO authenticated, anon;
