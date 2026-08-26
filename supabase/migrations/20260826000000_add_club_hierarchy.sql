-- 1. Add parent_club_id self-referencing foreign key to clubs table
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS parent_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

-- Index for fast parent-child lookups
CREATE INDEX IF NOT EXISTS idx_clubs_parent ON clubs(parent_club_id);

-- 2. Trigger function to prevent circular dependency loops in club hierarchy
CREATE OR REPLACE FUNCTION prevent_club_circular_dependency()
RETURNS TRIGGER AS $$
DECLARE
    v_current_parent_id UUID;
BEGIN
    IF NEW.parent_club_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- A club cannot be its own parent
    IF NEW.id = NEW.parent_club_id THEN
        RAISE EXCEPTION 'A club cannot be its own parent.';
    END IF;

    -- Traversal loop check to ensure new parent isn't an existing descendant
    v_current_parent_id := NEW.parent_club_id;
    WHILE v_current_parent_id IS NOT NULL LOOP
        IF v_current_parent_id = NEW.id THEN
            RAISE EXCEPTION 'Circular dependency detected in club affiliation hierarchy.';
        END IF;

        SELECT parent_club_id INTO v_current_parent_id
        FROM clubs
        WHERE id = v_current_parent_id;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER check_club_hierarchy_cycle
    BEFORE INSERT OR UPDATE OF parent_club_id ON clubs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_club_circular_dependency();