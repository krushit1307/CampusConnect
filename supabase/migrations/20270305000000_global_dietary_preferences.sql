ALTER TABLE profiles 
ADD COLUMN dietary_restrictions TEXT[] DEFAULT '{}'::TEXT[];

ALTER TABLE event_rsvps 
ADD COLUMN dietary_restrictions TEXT[] DEFAULT NULL;

CREATE OR REPLACE FUNCTION inject_global_dietary_restrictions()
RETURNS trigger AS $$
BEGIN
  IF NEW.dietary_restrictions IS NULL THEN
    SELECT dietary_restrictions INTO NEW.dietary_restrictions
    FROM profiles
    WHERE id = NEW.user_id;
    
    IF NEW.dietary_restrictions IS NULL THEN
      NEW.dietary_restrictions := '{}'::TEXT[];
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inject_global_dietary_restrictions
BEFORE INSERT ON event_rsvps
FOR EACH ROW
EXECUTE FUNCTION inject_global_dietary_restrictions();
