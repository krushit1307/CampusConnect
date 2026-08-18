-- Migration: 20261024000000_event_sponsorship_invoicing.sql
-- Description: Implement sponsor_invoices table, extend pitches status check constraint, and add RLS/outbox triggers (#3274).

-- 1. Add tax_id to clubs table
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS tax_id TEXT;

-- 2. Update pitches status check constraint to support 'Funds Received' status
ALTER TABLE public.sponsor_pitches DROP CONSTRAINT IF EXISTS sponsor_pitches_status_check;
ALTER TABLE public.sponsor_pitches ADD CONSTRAINT sponsor_pitches_status_check
  CHECK (status IN ('pending', 'approved', 'partial', 'rejected', 'Funds Received'));

-- 3. Create sponsor_invoices table
CREATE TABLE IF NOT EXISTS public.sponsor_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_id UUID NOT NULL REFERENCES public.sponsor_pitches(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT,
    stripe_invoice_pdf_url TEXT,
    amount_cents INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'uncollectible', 'void')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on sponsor_invoices
ALTER TABLE public.sponsor_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relevant sponsor invoices" ON public.sponsor_invoices
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sponsor_pitches sp
            LEFT JOIN public.funding_requests fr ON sp.request_id = fr.id
            LEFT JOIN public.sponsorship_campaigns sc ON sp.campaign_id = sc.id
            WHERE sp.id = sponsor_invoices.pitch_id
            AND (
                sc.sponsor_id = auth.uid()
                OR fr.club_id IN (
                    SELECT club_id FROM public.club_members WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved'
                )
            )
        )
    );

-- 4. Enable RLS UPDATE policy for club admins to accept/reject pitches
DROP POLICY IF EXISTS "Club admins can update pitches for their requests" ON public.sponsor_pitches;
CREATE POLICY "Club admins can update pitches for their requests" ON public.sponsor_pitches
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.funding_requests fr
            WHERE fr.id = sponsor_pitches.request_id
              AND fr.club_id IN (
                  SELECT cm.club_id
                  FROM public.club_members cm
                  WHERE cm.user_id = auth.uid()
                    AND cm.role = 'admin'
                    AND cm.status = 'approved'
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.funding_requests fr
            WHERE fr.id = sponsor_pitches.request_id
              AND fr.club_id IN (
                  SELECT cm.club_id
                  FROM public.club_members cm
                  WHERE cm.user_id = auth.uid()
                    AND cm.role = 'admin'
                    AND cm.status = 'approved'
              )
        )
    );

-- 5. Outbox trigger function enqueuing events when pitch transitions to 'approved'
CREATE OR REPLACE FUNCTION public.handle_sponsor_pitch_approved_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.outbox_events (payload)
    VALUES (
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'action', 'PITCH_APPROVED',
        'record', to_jsonb(NEW)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sponsor_pitch_approved_outbox ON public.sponsor_pitches;
CREATE TRIGGER trigger_sponsor_pitch_approved_outbox
    AFTER UPDATE OF status ON public.sponsor_pitches
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sponsor_pitch_approved_outbox();
