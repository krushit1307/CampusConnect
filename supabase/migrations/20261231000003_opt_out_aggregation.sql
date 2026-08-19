-- Create Communication Preferences Junction Table
CREATE TABLE IF NOT EXISTS user_communication_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- References your auth.users / profiles table
    club_id UUID NOT NULL, -- References your clubs table
    email_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    push_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, club_id)
);

-- Optimize Indexing for Pre-Flight Query Filters
CREATE INDEX IF NOT EXISTS idx_user_comm_lookup ON user_communication_preferences (user_id, club_id);
CREATE INDEX IF NOT EXISTS idx_user_email_status ON user_communication_preferences (user_id, email_enabled);

-- Enable RLS
ALTER TABLE user_communication_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own preferences" ON user_communication_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_communication_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_communication_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Automate tracking synchronization when a user follows a club
CREATE OR REPLACE FUNCTION public.sync_club_follow_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_communication_preferences (user_id, club_id)
    VALUES (NEW.user_id, NEW.club_id)
    ON CONFLICT (user_id, club_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Global Opt-Out Core (Supabase RPC)
CREATE OR REPLACE FUNCTION global_unsubscribe_all_communications(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Force-toggle all communication preferences to false for the user
    UPDATE user_communication_preferences
    SET email_enabled = FALSE,
        push_enabled = FALSE,
        updated_at = NOW()
    WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
