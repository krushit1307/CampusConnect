-- Migration for Automated "Event Feedback" Linguistic Sentiment Drift (Review Bombing IP Fingerprinting) (#5306)

CREATE TABLE IF NOT EXISTS public.event_review_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL, -- references event_reviews
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    ip_address INET NOT NULL,
    asn INTEGER,
    asn_org TEXT,
    is_datacenter BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'QUARANTINED', 'SHADOWBANNED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asn_threat_intelligence (
    asn INTEGER PRIMARY KEY,
    org_name TEXT NOT NULL,
    classification TEXT NOT NULL CHECK (classification IN ('RESIDENTIAL', 'UNIVERSITY', 'DATACENTER', 'VPN')),
    shadowbanned_until TIMESTAMPTZ
);

-- Seed with notorious Datacenter / Botnet origins
INSERT INTO public.asn_threat_intelligence (asn, org_name, classification) VALUES
(14618, 'Amazon.com', 'DATACENTER'),
(16509, 'Amazon.com', 'DATACENTER'),
(14061, 'DigitalOcean, LLC', 'DATACENTER'),
(24940, 'Hetzner Online GmbH', 'DATACENTER'),
(62240, 'Clouvider', 'DATACENTER'),
(9009, 'M247 Europe', 'VPN');

-- RLS
ALTER TABLE public.event_review_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asn_threat_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view telemetry" ON public.event_review_telemetry FOR ALL USING (true);
CREATE POLICY "Admins view threat intel" ON public.asn_threat_intelligence FOR ALL USING (true);

