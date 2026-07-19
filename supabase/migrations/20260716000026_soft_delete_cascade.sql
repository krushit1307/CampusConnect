ALTER TABLE comments
ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION cascade_post_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE comments
    SET deleted_at = NEW.deleted_at
    WHERE post_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cascade_post_soft_delete ON public.posts;
CREATE TRIGGER trigger_cascade_post_soft_delete
AFTER UPDATE OF deleted_at
ON posts
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION cascade_post_soft_delete();