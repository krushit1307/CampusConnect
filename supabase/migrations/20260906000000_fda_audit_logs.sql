-- Migration for Interactive "Dietary Restriction" Live IoT Temp Logging (FDA Blockchain Compliance Export) (#5308)

CREATE TABLE IF NOT EXISTS public.fda_haccp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL, -- (would reference vendors table)
    generated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    audit_date TIMESTAMPTZ DEFAULT NOW(),
    polygon_tx_hash TEXT NOT NULL,
    cv_spoilage_hash TEXT NOT NULL,
    report_status TEXT DEFAULT 'generated',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.fda_haccp_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view and generate fda audits" 
ON public.fda_haccp_audit_logs 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role
    )
);
