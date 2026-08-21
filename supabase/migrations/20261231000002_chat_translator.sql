-- Update profiles/users table to track preferred localization strings
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ui_language_preference VARCHAR(5) DEFAULT 'en';

-- Create Chat Messages Table with translation vectors
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL, -- References profiles(id)
    sender_name VARCHAR(255) NOT NULL,
    original_text TEXT NOT NULL,
    detected_source_lang VARCHAR(5),
    translated_text_en TEXT, -- English base translation string used as universal fallback
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimize message query lookups for real-time dashboard loops
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Enable Supabase Realtime for the Chat Messages Table
ALTER REPLICA IDENTITY FULL ON chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Security Policies (Row Level Security)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read chat_messages" ON chat_messages 
    FOR SELECT USING (auth.role() = 'authenticated');

-- We omit direct INSERT policy because the Edge Function handles insertion via Service Role
