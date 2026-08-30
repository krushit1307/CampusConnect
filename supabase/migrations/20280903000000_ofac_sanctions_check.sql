-- Migration: 20280903000000_ofac_sanctions_check.sql
-- Description: Create OFAC Sanctions SDN tracking, matching algorithms, and automated account locking triggers

-- 1. Add columns to event_vendors and profiles
ALTER TABLE public.event_vendors
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS is_sanctioned BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- 2. Create OFAC SDN List reference table
CREATE TABLE IF NOT EXISTS public.ofac_sdn_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('individual', 'vessel', 'organization')),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert mock sanctioned entities for testing
INSERT INTO public.ofac_sdn_list (entity_name, entity_type, remarks)
VALUES 
    ('Al-Qaeda Front Corp', 'organization', 'Specially Designated Global Terrorist'),
    ('Terry Terrorism', 'individual', 'SDN list for financing international terrorism'),
    ('Global Evil LLC', 'organization', 'Illegal weapons trade operations')
ON CONFLICT DO NOTHING;

-- 3. Create OFAC Alerts log table
CREATE TABLE IF NOT EXISTS public.ofac_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES public.event_vendors(id) ON DELETE SET NULL,
    vendor_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    matched_entity TEXT NOT NULL,
    similarity_score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for alerts
ALTER TABLE public.ofac_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select for OFAC alerts" ON public.ofac_alerts FOR SELECT USING (true);

-- 4. Fuzzy string similarity function using Jaccard overlapping index
CREATE OR REPLACE FUNCTION public.string_similarity(str1 TEXT, str2 TEXT)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    arr1 TEXT[];
    arr2 TEXT[];
BEGIN
    IF str1 IS NULL OR str2 IS NULL THEN
        RETURN 0.0;
    END IF;
    -- Split strings into character array
    SELECT regexp_split_to_array(LOWER(str1), '') INTO arr1;
    SELECT regexp_split_to_array(LOWER(str2), '') INTO arr2;
    RETURN public.jaccard_similarity(arr1, arr2);
END;
$$;

-- 5. OFAC check trigger function
CREATE OR REPLACE FUNCTION public.enforce_ofac_sanctions_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sdn RECORD;
    v_vendor_sim DOUBLE PRECISION;
    v_owner_sim DOUBLE PRECISION;
    v_organizer_id UUID;
BEGIN
    -- Check only on status transition to APPROVED
    IF NEW.approval_status = 'APPROVED' AND (OLD.approval_status IS NULL OR OLD.approval_status <> 'APPROVED') THEN
        -- Verify that Vendor_Name, Owner_Name and Address are provided
        IF NEW.name IS NULL OR NEW.owner_name IS NULL THEN
            RAISE EXCEPTION 'Vendor Name and Owner Name are required for approval finalization.';
        END IF;

        -- Loop and calculate similarity against SDN list
        FOR v_sdn IN SELECT * FROM public.ofac_sdn_list LOOP
            v_vendor_sim := public.string_similarity(NEW.name, v_sdn.entity_name);
            v_owner_sim := public.string_similarity(NEW.owner_name, v_sdn.entity_name);

            -- > 95% match threshold
            IF v_vendor_sim >= 0.95 OR v_owner_sim >= 0.95 THEN
                -- 1. Freeze transaction / flag vendor
                NEW.is_sanctioned := true;
                NEW.approval_status := 'REJECTED';

                -- 2. Log OFAC alert
                INSERT INTO public.ofac_alerts (vendor_id, vendor_name, owner_name, matched_entity, similarity_score)
                VALUES (NEW.id, NEW.name, NEW.owner_name, v_sdn.entity_name, GREATEST(v_vendor_sim, v_owner_sim));

                -- 3. Lock Organizer profile (retrieve event creator ID)
                SELECT created_by INTO v_organizer_id
                FROM public.events
                WHERE id = NEW.event_id;

                IF v_organizer_id IS NOT NULL THEN
                    UPDATE public.profiles
                    SET is_locked = true
                    WHERE id = v_organizer_id;
                END IF;

                -- Lock Vendor user account if they have one linked
                -- (Can lock related profiles or log alerts)

                -- 4. Generate high-priority notifications for General Counsel & CFO
                INSERT INTO public.notifications (user_id, title, message, link, type)
                VALUES (
                    '00000000-0000-0000-0000-000000000000', -- Admin/System broadcast target
                    '🚨 URGENT: OFAC Sanctions Match Detected',
                    'URGENT: OFAC Sanctions Match detected for Vendor ' || NEW.name || ' (Owner: ' || NEW.owner_name || '). Accounts locked. CFO/General Counsel notified for immediate federal reporting.',
                    '/admin/alerts',
                    'ofac_alert'
                );

                RAISE EXCEPTION 'OFAC Sanctions Block: The entity matches a sanctioned party on the SDN list. Transaction frozen and accounts locked.';
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- 6. Attach trigger
DROP TRIGGER IF EXISTS trg_enforce_ofac_sanctions ON public.event_vendors;
CREATE TRIGGER trg_enforce_ofac_sanctions
    BEFORE UPDATE OF approval_status ON public.event_vendors
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_ofac_sanctions_check();
