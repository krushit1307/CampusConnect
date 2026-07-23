-- REusable trigger function to auto-update the updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to all tables that have an updated_at column
CREATE TRIGGER set_updated_at_profiles
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_updated_at_clubs
BEFORE UPDATE ON clubs
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_updated_at_events
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_updated_at_posts
BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_updated_at_comments
BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
