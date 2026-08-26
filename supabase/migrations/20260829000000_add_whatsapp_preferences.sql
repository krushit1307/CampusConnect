-- 1. Create preferred_contact_method enum type if not exists
DO $$ BEGIN
    CREATE TYPE preferred_contact_method AS ENUM ('sms', 'whatsapp', 'email');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS preferred_contact_method preferred_contact_method DEFAULT 'email' NOT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT FALSE NOT NULL;