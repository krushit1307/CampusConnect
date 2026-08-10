-- Enforce that all newly registered users have an email ending in a university domain (.edu)
CREATE OR REPLACE FUNCTION public.enforce_university_email()
RETURNS trigger AS $$
BEGIN
  -- Check if the email address does not end in '.edu' (case-insensitive)
  -- Also handles NULL gracefully by failing the check
  IF NEW.email IS NULL OR NEW.email NOT ILIKE '%.edu' THEN
    RAISE EXCEPTION 'Only university email addresses (.edu) are allowed for signup.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run before a new user is inserted into auth.users
CREATE OR REPLACE TRIGGER enforce_university_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.enforce_university_email();
