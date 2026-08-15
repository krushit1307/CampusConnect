-- Update profiles table for referrals and device fingerprinting
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS referral_rewarded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by_id);
CREATE INDEX IF NOT EXISTS idx_profiles_device_fingerprint ON profiles(device_fingerprint);

-- Add CHECK constraint to prevent self-referral
ALTER TABLE profiles 
ADD CONSTRAINT check_not_self_referral CHECK (referred_by_id <> id);

-- Trigger to auto-generate referral code on new profile
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    base_code TEXT;
    is_unique BOOLEAN := FALSE;
BEGIN
    IF NEW.referral_code IS NULL THEN
        -- Basic slugification of full_name or email prefix
        base_code := LOWER(REGEXP_REPLACE(COALESCE(NEW.full_name, 'user'), '[^a-zA-Z0-9]', '', 'g'));
        -- Truncate base code if too long
        base_code := SUBSTRING(base_code FROM 1 FOR 10);
        
        WHILE NOT is_unique LOOP
            new_code := base_code || floor(random() * 10000)::text;
            
            IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = new_code) THEN
                is_unique := TRUE;
                NEW.referral_code := new_code;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON profiles;
CREATE TRIGGER trg_generate_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- Override handle_new_user to resolve referral_code to referred_by_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_referred_by_id UUID;
BEGIN
  IF new.raw_user_meta_data->>'referred_by_code' IS NOT NULL THEN
    SELECT id INTO v_referred_by_id FROM public.profiles WHERE referral_code = new.raw_user_meta_data->>'referred_by_code';
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, student_id_number, referred_by_id)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'student_id_number',
    v_referred_by_id
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
