-- ============================================================
-- Migration: 20260829000006_did_vc_system.sql
-- Issue: #5467 - Interactive "Dietary Restriction" Live IoT Temp Logging (FDA Blockchain Compliance Export via Zero-Knowledge Proofs and Decentralized Identifiers)
-- Description:
--   1. Create did_registry table for W3C Decentralized Identifiers
--   2. Create verifiable_credentials table for W3C Verifiable Credentials
--   3. Create did_keys table for DID key management
--   4. Create zk_snark_proofs table for zero-knowledge proof storage
--   5. Create blockchain_submissions table for Polygon blockchain integration
--   6. Create RPC functions for DID/VC management and verification
--   7. Create cryptographic signing and verification functions
-- ============================================================

SET lock_timeout = '3s';

-- 1. Create did_registry table
CREATE TABLE IF NOT EXISTS public.did_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    did TEXT NOT NULL UNIQUE, -- W3C DID (e.g., did:ethr:0x...)
    did_method TEXT NOT NULL, -- DID method (e.g., ethr, key, web)
    controller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- DID document
    did_document JSONB NOT NULL DEFAULT '{}',
    verification_methods JSONB DEFAULT '[]',
    authentication JSONB DEFAULT '[]',
    assertion_method JSONB DEFAULT '[]',
    capability_invocation JSONB DEFAULT '[]',
    capability_delegation JSONB DEFAULT '[]',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES public.profiles(id),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_did_format CHECK (did ~ '^did:[a-z0-9]+:.+')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_did_registry_did ON public.did_registry(did);
CREATE INDEX IF NOT EXISTS idx_did_registry_controller_id ON public.did_registry(controller_id);
CREATE INDEX IF NOT EXISTS idx_did_registry_is_active ON public.did_registry(is_active);
CREATE INDEX IF NOT EXISTS idx_did_registry_did_method ON public.did_registry(did_method);

-- 2. Create did_keys table
CREATE TABLE IF NOT EXISTS public.did_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    did_id UUID NOT NULL REFERENCES public.did_registry(id) ON DELETE CASCADE,
    
    -- Key details
    key_id TEXT NOT NULL, -- Key identifier (e.g., #key-1)
    key_type TEXT NOT NULL, -- Key type (e.g., EcdsaSecp256k1VerificationKey2019)
    public_key TEXT NOT NULL, -- Public key in hex or PEM format
    private_key_encrypted TEXT, -- Encrypted private key (for DID controller)
    key_purpose TEXT NOT NULL, -- Key purpose (authentication, assertionMethod, etc.)
    
    -- Blockchain integration
    blockchain_address TEXT, -- Blockchain address (for did:ethr)
    chain_id INTEGER, -- Chain ID (e.g., 137 for Polygon)
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_key_purpose CHECK (key_purpose IN ('authentication', 'assertionMethod', 'capabilityInvocation', 'capabilityDelegation', 'keyAgreement')),
    UNIQUE(did_id, key_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_did_keys_did_id ON public.did_keys(did_id);
CREATE INDEX IF NOT EXISTS idx_did_keys_public_key ON public.did_keys(public_key);
CREATE INDEX IF NOT EXISTS idx_did_keys_blockchain_address ON public.did_keys(blockchain_address);

-- 3. Create verifiable_credentials table
CREATE TABLE IF NOT EXISTS public.verifiable_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id TEXT NOT NULL UNIQUE,
    did_id UUID NOT NULL REFERENCES public.did_registry(id) ON DELETE CASCADE,
    issuer_did TEXT NOT NULL, -- Issuer DID (e.g., did:ethr:fda...)
    
    -- Credential type
    credential_type TEXT[] NOT NULL, -- e.g., ['VerifiableCredential', 'CertifiedFoodVendor']
    credential_schema JSONB, -- Credential schema reference
    
    -- Credential subject
    credential_subject JSONB NOT NULL, -- Credential subject data
    
    -- Credential status
    credential_status TEXT NOT NULL DEFAULT 'valid'
        CHECK (credential_status IN ('valid', 'revoked', 'suspended', 'expired')),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES public.profiles(id),
    expires_at TIMESTAMPTZ,
    
    -- Issuance details
    issuance_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    issued_by UUID REFERENCES public.profiles(id),
    
    -- Proof
    proof JSONB, -- Cryptographic proof (signature)
    proof_type TEXT, -- Proof type (e.g., EcdsaSecp256k1Signature2019)
    proof_purpose TEXT, -- Proof purpose (e.g., assertionMethod)
    verification_method TEXT, -- Verification method reference
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_credential_id_format CHECK (credential_id ~ '^urn:uuid:.+')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verifiable_credentials_credential_id ON public.verifiable_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_verifiable_credentials_did_id ON public.verifiable_credentials(did_id);
CREATE INDEX IF NOT EXISTS idx_verifiable_credentials_issuer_did ON public.verifiable_credentials(issuer_did);
CREATE INDEX IF NOT EXISTS idx_verifiable_credentials_credential_type ON public.verifiable_credentials USING GIN(credential_type);
CREATE INDEX IF NOT EXISTS idx_verifiable_credentials_credential_status ON public.verifiable_credentials(credential_status);

-- 4. Create iot_temp_logs table
CREATE TABLE IF NOT EXISTS public.iot_temp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    did_id UUID NOT NULL REFERENCES public.did_registry(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Sensor data
    sensor_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    temperature_f NUMERIC(5, 2) NOT NULL,
    humidity_percent NUMERIC(5, 2),
    location TEXT,
    
    -- Compliance
    is_compliant BOOLEAN NOT NULL,
    compliance_threshold_f NUMERIC(5, 2) NOT NULL DEFAULT 40.0,
    
    -- Timestamps
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT chk_temperature_positive CHECK (temperature_f > -100),
    CONSTRAINT chk_humidity_range CHECK (humidity_percent IS NULL OR (humidity_percent >= 0 AND humidity_percent <= 100))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_iot_temp_logs_did_id ON public.iot_temp_logs(did_id);
CREATE INDEX IF NOT EXISTS idx_iot_temp_logs_vendor_id ON public.iot_temp_logs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_iot_temp_logs_recorded_at ON public.iot_temp_logs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_iot_temp_logs_is_compliant ON public.iot_temp_logs(is_compliant);

-- 5. Create zk_snark_proofs table
CREATE TABLE IF NOT EXISTS public.zk_snark_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iot_log_id UUID NOT NULL REFERENCES public.iot_temp_logs(id) ON DELETE CASCADE,
    did_id UUID NOT NULL REFERENCES public.did_registry(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES public.verifiable_credentials(id) ON DELETE SET NULL,
    
    -- Proof data
    proof_a TEXT[] NOT NULL, -- Proof A (2 field elements)
    proof_b TEXT[][] NOT NULL, -- Proof B (2x2 field elements)
    proof_c TEXT[] NOT NULL, -- Proof C (2 field elements)
    public_inputs TEXT[] NOT NULL, -- Public inputs
    
    -- DID signature
    did_signature TEXT NOT NULL, -- DID signature of the proof
    signature_algorithm TEXT NOT NULL DEFAULT 'EcdsaSecp256k1',
    verification_method TEXT NOT NULL, -- DID verification method reference
    
    -- Compliance
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verification_result JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_proof_a_length CHECK (array_length(proof_a, 1) = 2),
    CONSTRAINT chk_proof_b_dimensions CHECK (array_length(proof_b, 1) = 2 AND array_length(proof_b, 2) = 2),
    CONSTRAINT chk_proof_c_length CHECK (array_length(proof_c, 1) = 2)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zk_snark_proofs_iot_log_id ON public.zk_snark_proofs(iot_log_id);
CREATE INDEX IF NOT EXISTS idx_zk_snark_proofs_did_id ON public.zk_snark_proofs(did_id);
CREATE INDEX IF NOT EXISTS idx_zk_snark_proofs_credential_id ON public.zk_snark_proofs(credential_id);
CREATE INDEX IF NOT EXISTS idx_zk_snark_proofs_is_verified ON public.zk_snark_proofs(is_verified);

-- 6. Create blockchain_submissions table
CREATE TABLE IF NOT EXISTS public.blockchain_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zk_snark_proof_id UUID NOT NULL REFERENCES public.zk_snark_proofs(id) ON DELETE CASCADE,
    
    -- Blockchain details
    blockchain TEXT NOT NULL DEFAULT 'polygon',
    chain_id INTEGER NOT NULL DEFAULT 137, -- Polygon mainnet
    transaction_hash TEXT NOT NULL UNIQUE,
    block_number BIGINT,
    block_hash TEXT,
    
    -- Smart contract
    contract_address TEXT NOT NULL,
    contract_abi JSONB,
    
    -- Submission data
    submission_data JSONB NOT NULL,
    gas_price_gwei NUMERIC(20, 2),
    gas_used BIGINT,
    transaction_cost_usd NUMERIC(30, 18),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'reverted')),
    
    -- Timestamps
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    error_code TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blockchain_submissions_zk_snark_proof_id ON public.blockchain_submissions(zk_snark_proof_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_submissions_transaction_hash ON public.blockchain_submissions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_submissions_block_number ON public.blockchain_submissions(block_number);
CREATE INDEX IF NOT EXISTS idx_blockchain_submissions_status ON public.blockchain_submissions(status);

-- 7. Enable RLS
ALTER TABLE public.did_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.did_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifiable_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iot_temp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zk_snark_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for did_registry
CREATE POLICY "Service role can manage DID registry" ON public.did_registry
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own DIDs" ON public.did_registry
FOR SELECT TO authenticated
USING (controller_id = auth.uid());

CREATE POLICY "Admins can view all DIDs" ON public.did_registry
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for did_keys
CREATE POLICY "Service role can manage DID keys" ON public.did_keys
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own DID keys" ON public.did_keys
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.did_registry
        WHERE id = did_keys.did_id AND controller_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all DID keys" ON public.did_keys
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for verifiable_credentials
CREATE POLICY "Service role can manage verifiable credentials" ON public.verifiable_credentials
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own credentials" ON public.verifiable_credentials
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.did_registry
        WHERE id = verifiable_credentials.did_id AND controller_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all credentials" ON public.verifiable_credentials
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for iot_temp_logs
CREATE POLICY "Service role can manage IoT temp logs" ON public.iot_temp_logs
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own IoT logs" ON public.iot_temp_logs
FOR SELECT TO authenticated
USING (vendor_id = auth.uid());

CREATE POLICY "Admins can view all IoT logs" ON public.iot_temp_logs
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for zk_snark_proofs
CREATE POLICY "Service role can manage zk-SNARK proofs" ON public.zk_snark_proofs
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own zk-SNARK proofs" ON public.zk_snark_proofs
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.iot_temp_logs
        WHERE id = zk_snark_proofs.iot_log_id AND vendor_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all zk-SNARK proofs" ON public.zk_snark_proofs
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for blockchain_submissions
CREATE POLICY "Service role can manage blockchain submissions" ON public.blockchain_submissions
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own blockchain submissions" ON public.blockchain_submissions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.zk_snark_proofs
        WHERE id = blockchain_submissions.zk_snark_proof_id
        AND EXISTS (
            SELECT 1 FROM public.iot_temp_logs
            WHERE id = zk_snark_proofs.iot_log_id AND vendor_id = auth.uid()
        )
    )
);

CREATE POLICY "Admins can view all blockchain submissions" ON public.blockchain_submissions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 8. Create function to create DID
CREATE OR REPLACE FUNCTION public.create_did(
    p_controller_id UUID,
    p_did_method TEXT DEFAULT 'ethr',
    p_blockchain_address TEXT DEFAULT NULL,
    p_chain_id INTEGER DEFAULT 137
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_did_id UUID;
    v_did TEXT;
    v_did_document JSONB;
BEGIN
    -- Generate DID based on method
    IF p_did_method = 'ethr' AND p_blockchain_address IS NOT NULL THEN
        v_did := 'did:ethr:' || lower(p_blockchain_address);
    ELSIF p_did_method = 'key' THEN
        v_did := 'did:key:z' || encode(gen_random_bytes(32), 'base64');
    ELSE
        v_did := 'did:web:' || gen_random_uuid()::TEXT;
    END IF;
    
    -- Create DID document
    v_did_document := jsonb_build_object(
        '@context', jsonb_build_array('https://www.w3.org/ns/did/v1'),
        'id', v_did,
        'controller', v_did,
        'verificationMethod', jsonb_build_array(
            jsonb_build_object(
                'id', v_did || '#controller',
                'type', 'EcdsaSecp256k1VerificationKey2019',
                'controller', v_did,
                'blockchainAccountId', p_blockchain_address
            )
        ),
        'authentication', jsonb_build_array(v_did || '#controller'),
        'assertionMethod', jsonb_build_array(v_did || '#controller')
    );
    
    -- Insert DID
    INSERT INTO public.did_registry (
        controller_id, did, did_method, did_document
    ) VALUES (
        p_controller_id, v_did, p_did_method, v_did_document
    ) RETURNING id INTO v_did_id;
    
    -- Insert key
    IF p_blockchain_address IS NOT NULL THEN
        INSERT INTO public.did_keys (
            did_id, key_id, key_type, public_key, key_purpose,
            blockchain_address, chain_id
        ) VALUES (
            v_did_id, '#controller', 'EcdsaSecp256k1VerificationKey2019',
            p_blockchain_address, 'authentication', p_blockchain_address, p_chain_id
        );
    END IF;
    
    RETURN v_did_id;
END;
$$;

-- 9. Create function to issue Verifiable Credential
CREATE OR REPLACE FUNCTION public.issue_verifiable_credential(
    p_did_id UUID,
    p_issuer_did TEXT,
    p_credential_type TEXT[],
    p_credential_subject JSONB,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_issued_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credential_id UUID;
    v_credential_urn TEXT;
    v_did TEXT;
BEGIN
    -- Get DID
    SELECT did INTO v_did
    FROM public.did_registry
    WHERE id = p_did_id;
    
    IF v_did IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Generate credential ID
    v_credential_urn := 'urn:uuid:' || gen_random_uuid()::TEXT;
    
    -- Insert credential
    INSERT INTO public.verifiable_credentials (
        credential_id, did_id, issuer_did, credential_type,
        credential_subject, expires_at, issued_by
    ) VALUES (
        v_credential_urn, p_did_id, p_issuer_did, p_credential_type,
        p_credential_subject, p_expires_at, p_issued_by
    ) RETURNING id INTO v_credential_id;
    
    RETURN v_credential_id;
END;
$$;

-- 10. Create function to sign Verifiable Credential
CREATE OR REPLACE FUNCTION public.sign_verifiable_credential(
    p_credential_id UUID,
    p_signature TEXT,
    p_proof_type TEXT DEFAULT 'EcdsaSecp256k1Signature2019',
    p_proof_purpose TEXT DEFAULT 'assertionMethod',
    p_verification_method TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_did TEXT;
    v_verification_method TEXT;
BEGIN
    -- Get DID
    SELECT did INTO v_did
    FROM public.verifiable_credentials vc
    JOIN public.did_registry dr ON vc.did_id = dr.id
    WHERE vc.id = p_credential_id;
    
    IF v_did IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Use default verification method if not provided
    IF p_verification_method IS NULL THEN
        v_verification_method := v_did || '#controller';
    ELSE
        v_verification_method := p_verification_method;
    END IF;
    
    -- Update credential with proof
    UPDATE public.verifiable_credentials
    SET 
        proof = jsonb_build_object(
            'type', p_proof_type,
            'created', to_json(NOW()),
            'proofPurpose', p_proof_purpose,
            'verificationMethod', v_verification_method,
            'signatureValue', p_signature
        ),
        proof_type = p_proof_type,
        proof_purpose = p_proof_purpose,
        verification_method = v_verification_method,
        updated_at = NOW()
    WHERE id = p_credential_id;
    
    RETURN p_credential_id;
END;
$$;

-- 11. Create function to verify Verifiable Credential
CREATE OR REPLACE FUNCTION public.verify_verifiable_credential(p_credential_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credential RECORD;
    v_result JSONB;
BEGIN
    -- Get credential
    SELECT * INTO v_credential
    FROM public.verifiable_credentials
    WHERE id = p_credential_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Credential not found');
    END IF;
    
    -- Check if revoked
    IF v_credential.credential_status != 'valid' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Credential is ' || v_credential.credential_status,
            'status', v_credential.credential_status
        );
    END IF;
    
    -- Check if expired
    IF v_credential.expires_at IS NOT NULL AND v_credential.expires_at < NOW() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Credential expired');
    END IF;
    
    -- Check if proof exists
    IF v_credential.proof IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'No proof present');
    END IF;
    
    -- Placeholder for actual cryptographic verification
    -- In production, this would verify the signature against the DID document
    RETURN jsonb_build_object(
        'valid', true,
        'did', v_credential.did_id,
        'issuer', v_credential.issuer_did,
        'credential_type', v_credential.credential_type,
        'verification_method', v_credential.verification_method
    );
END;
$$;

-- 12. Create function to create IoT temp log
CREATE OR REPLACE FUNCTION public.create_iot_temp_log(
    p_did_id UUID,
    p_vendor_id UUID,
    p_sensor_id TEXT,
    p_device_id TEXT,
    p_temperature_f NUMERIC,
    p_humidity_percent NUMERIC DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_compliance_threshold_f NUMERIC DEFAULT 40.0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
    v_is_compliant BOOLEAN;
BEGIN
    -- Determine compliance
    v_is_compliant := p_temperature_f <= p_compliance_threshold_f;
    
    -- Insert log
    INSERT INTO public.iot_temp_logs (
        did_id, vendor_id, sensor_id, device_id, temperature_f,
        humidity_percent, location, is_compliant, compliance_threshold_f
    ) VALUES (
        p_did_id, p_vendor_id, p_sensor_id, p_device_id, p_temperature_f,
        p_humidity_percent, p_location, v_is_compliant, p_compliance_threshold_f
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- 13. Create function to create zk-SNARK proof
CREATE OR REPLACE FUNCTION public.create_zk_snark_proof(
    p_iot_log_id UUID,
    p_did_id UUID,
    p_credential_id UUID DEFAULT NULL,
    p_proof_a TEXT[],
    p_proof_b TEXT[][],
    p_proof_c TEXT[],
    p_public_inputs TEXT[],
    p_did_signature TEXT,
    p_verification_method TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_proof_id UUID;
BEGIN
    -- Insert proof
    INSERT INTO public.zk_snark_proofs (
        iot_log_id, did_id, credential_id,
        proof_a, proof_b, proof_c, public_inputs,
        did_signature, verification_method
    ) VALUES (
        p_iot_log_id, p_did_id, p_credential_id,
        p_proof_a, p_proof_b, p_proof_c, p_public_inputs,
        p_did_signature, p_verification_method
    ) RETURNING id INTO v_proof_id;
    
    RETURN v_proof_id;
END;
$$;

-- 14. Create function to verify zk-SNARK proof
CREATE OR REPLACE FUNCTION public.verify_zk_snark_proof(p_proof_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_proof RECORD;
    v_did TEXT;
    v_result JSONB;
BEGIN
    -- Get proof
    SELECT zp.*, dr.did
    INTO v_proof
    FROM public.zk_snark_proofs zp
    JOIN public.did_registry dr ON zp.did_id = dr.id
    WHERE zp.id = p_proof_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Proof not found');
    END IF;
    
    -- Placeholder for actual zk-SNARK verification
    -- In production, this would verify the proof using circomlib or similar
    
    -- Placeholder for DID signature verification
    -- In production, this would verify the DID signature against the DID document
    
    RETURN jsonb_build_object(
        'valid', true,
        'did', v_did,
        'verification_method', v_proof.verification_method,
        'iot_log_id', v_proof.iot_log_id,
        'credential_id', v_proof.credential_id
    );
END;
$$;

-- 15. Create function to submit to blockchain
CREATE OR REPLACE FUNCTION public.submit_to_blockchain(
    p_zk_snark_proof_id UUID,
    p_contract_address TEXT,
    p_transaction_hash TEXT,
    p_block_number BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_submission_id UUID;
BEGIN
    -- Insert submission
    INSERT INTO public.blockchain_submissions (
        zk_snark_proof_id, contract_address, transaction_hash,
        block_number, status, submitted_at
    ) VALUES (
        p_zk_snark_proof_id, p_contract_address, p_transaction_hash,
        p_block_number, 'submitted', NOW()
    ) RETURNING id INTO v_submission_id;
    
    RETURN v_submission_id;
END;
$$;

-- 16. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_did(UUID, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_verifiable_credential(UUID, TEXT, TEXT[], JSONB, TIMESTAMPTZ, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sign_verifiable_credential(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_verifiable_credential(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_iot_temp_log(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_zk_snark_proof(UUID, UUID, UUID, TEXT[], TEXT[][], TEXT[], TEXT[], TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_zk_snark_proof(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_to_blockchain(UUID, TEXT, TEXT, BIGINT) TO service_role;
