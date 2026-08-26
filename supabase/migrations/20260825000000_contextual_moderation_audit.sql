-- =============================================================================
-- Migration: Contextual Moderation Audit Table
-- Issue: #4419 - Implement 'Automated "Profanity/Harassment" Contextual AI'
--
-- Creates the audit table for logging contextual AI moderation decisions.
-- When the basic NLP filter flags a message for violence, the contextual AI
-- analyzer evaluates whether it's a literal threat or harmless slang.
-- All decisions are logged here for admin review and false positive tracking.
-- =============================================================================

-- 1. Create the contextual_moderation_audit table
CREATE TABLE IF NOT EXISTS contextual_moderation_audit (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id    UUID NOT NULL,
    user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    source_table  TEXT NOT NULL CHECK (source_table IN ('event_chat_messages', 'qna_messages', 'chat_messages', 'posts')),
    original_flag_reason TEXT NOT NULL,
    llm_is_threat BOOLEAN NOT NULL DEFAULT true,
    llm_confidence NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (llm_confidence >= 0 AND llm_confidence <= 1),
    llm_reasoning TEXT NOT NULL,
    original_content TEXT NOT NULL,
    reviewed      BOOLEAN NOT NULL DEFAULT false,
    reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
    review_note   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at   TIMESTAMPTZ
);

-- 2. Enable Row Level Security
ALTER TABLE contextual_moderation_audit ENABLE ROW LEVEL SECURITY;

-- 3. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contextual_audit_user ON contextual_moderation_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_contextual_audit_source ON contextual_moderation_audit(source_table);
CREATE INDEX IF NOT EXISTS idx_contextual_audit_reviewed ON contextual_moderation_audit(reviewed) WHERE NOT reviewed;
CREATE INDEX IF NOT EXISTS idx_contextual_audit_created ON contextual_moderation_audit(created_at DESC);

-- 4. RLS Policies

-- Admins (system_admin) can see all audit records
CREATE POLICY "Admins can view all contextual audit records"
    ON contextual_moderation_audit
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'system_admin'
        )
    );

-- Moderators with safety or all permissions can see all audit records
CREATE POLICY "Safety moderators can view contextual audit records"
    ON contextual_moderation_audit
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.can_moderate_safety = true OR profiles.can_moderate_all = true)
        )
    );

-- Admins can update (review) audit records
CREATE POLICY "Admins can review contextual audit records"
    ON contextual_moderation_audit
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'system_admin' OR profiles.can_moderate_all = true)
        )
    );

-- Service role can insert audit records (from edge functions)
CREATE POLICY "Service role can insert contextual audit records"
    ON contextual_moderation_audit
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- 5. Grant necessary permissions
GRANT SELECT, UPDATE ON contextual_moderation_audit TO authenticated;
GRANT INSERT ON contextual_moderation_audit TO service_role;
