-- 1. Create sso_identity_providers table for academic identity federations
CREATE TABLE IF NOT EXISTS sso_identity_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT UNIQUE NOT NULL, -- e.g. 'harvard.edu'
    institution_name TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    sso_redirect_url TEXT NOT NULL,
    x509_public_cert TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for domain routing lookups
CREATE INDEX IF NOT EXISTS idx_sso_idp_domain ON sso_identity_providers(domain);

-- 2. Extend user_preferences to track federated identity status
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS is_federated_user BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS home_institution_domain TEXT,
ADD COLUMN IF NOT EXISTS external_subject_id TEXT;

-- Index for federated user resolution
CREATE INDEX IF NOT EXISTS idx_federated_user_lookup ON user_preferences(home_institution_domain, external_subject_id);

-- 3. Stored RPC procedure for Just-In-Time (JIT) Federated User Provisioning
CREATE OR REPLACE FUNCTION provision_jit_federated_user(
    p_email TEXT,
    p_full_name TEXT,
    p_home_domain TEXT,
    p_external_subject_id TEXT
)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    is_newly_provisioned BOOLEAN,
    is_federated BOOLEAN
) AS $$
DECLARE
    v_user_id UUID;
    v_is_new BOOLEAN := FALSE;
BEGIN
    -- Check if user exists by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(p_email);

    IF NOT FOUND THEN
        -- Create user in auth.users with email pre-verified
        INSERT INTO auth.users (email, email_confirmed_at, raw_user_meta_data)
        VALUES (
            p_email, 
            NOW(), 
            jsonb_build_object('full_name', p_full_name, 'federated', true, 'home_domain', p_home_domain)
        )
        RETURNING id INTO v_user_id;

        v_is_new := TRUE;
    END IF;

    -- Upsert user preferences with federated identity flags
    INSERT INTO user_preferences (
        user_id,
        full_name,
        is_federated_user,
        home_institution_domain,
        external_subject_id
    )
    VALUES (
        v_user_id,
        p_full_name,
        TRUE,
        p_home_domain,
        p_external_subject_id
    )
    ON CONFLICT (user_id) DO UPDATE
    SET is_federated_user = TRUE,
        home_institution_domain = EXCLUDED.home_institution_domain,
        external_subject_id = EXCLUDED.external_subject_id,
        updated_at = NOW();

    RETURN QUERY SELECT v_user_id, p_email, v_is_new, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;