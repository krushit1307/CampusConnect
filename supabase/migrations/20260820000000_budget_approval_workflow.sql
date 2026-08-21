-- ============================================================
-- Migration: Automated Budget Request and Approval Workflow
-- Issue #2897
--
-- Creates:
--   1. `budget_requests` table (linked to event_id).
--   2. `budget_line_items` table (itemized costs, supports partial approval).
--   3. `budget_approval_audit_log` table (accountability for all status changes).
--   4. `requires_funding` column on `events` (blocks publication until approved).
--   5. RLS policies for club treasurers and Student Union admins.
--   6. RPCs for submitting, approving, rejecting, and requesting changes.
-- ============================================================

-- ── Step 1: Add `requires_funding` to events ──────────────────
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS requires_funding BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Step 2: Create budget_requests table ───────────────────────
CREATE TABLE IF NOT EXISTS public.budget_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
    total_requested DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_approved DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    admin_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_requests_event ON public.budget_requests (event_id);
CREATE INDEX IF NOT EXISTS idx_budget_requests_status ON public.budget_requests (status);

-- ── Step 3: Create budget_line_items table ─────────────────────
CREATE TABLE IF NOT EXISTS public.budget_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_request_id UUID NOT NULL REFERENCES public.budget_requests(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    requested_amount DECIMAL(10, 2) NOT NULL,
    approved_amount DECIMAL(10, 2),
    quote_pdf_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_line_items_request ON public.budget_line_items (budget_request_id);

-- ── Step 4: Create budget_approval_audit_log ────────────────────
CREATE TABLE IF NOT EXISTS public.budget_approval_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_request_id UUID NOT NULL REFERENCES public.budget_requests(id) ON DELETE CASCADE,
    line_item_id UUID REFERENCES public.budget_line_items(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('submit', 'approve', 'reject', 'request_changes', 'modify_line_item', 'comment')),
    previous_status TEXT,
    new_status TEXT,
    comment TEXT,
    performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_audit_request ON public.budget_approval_audit_log (budget_request_id);

-- ── Step 5: RLS Policies ───────────────────────────────────────
ALTER TABLE public.budget_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_approval_audit_log ENABLE ROW LEVEL SECURITY;

-- Budget requests: clubs can view their own, admins can view all.
DROP POLICY IF EXISTS "Clubs can view their budget requests." ON public.budget_requests;
CREATE POLICY "Clubs can view their budget requests."
ON public.budget_requests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = budget_requests.club_id
          AND user_id = auth.uid()
          AND status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Club admins can create budget requests.
DROP POLICY IF EXISTS "Club admins can create budget requests." ON public.budget_requests;
CREATE POLICY "Club admins can create budget requests."
ON public.budget_requests FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = budget_requests.club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    )
);

-- Only admins can update budget request status (approve/reject).
DROP POLICY IF EXISTS "Admins can update budget requests." ON public.budget_requests;
CREATE POLICY "Admins can update budget requests."
ON public.budget_requests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Line items: same visibility as budget requests (via join).
DROP POLICY IF EXISTS "Clubs can view their line items." ON public.budget_line_items;
CREATE POLICY "Clubs can view their line items."
ON public.budget_line_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.budget_requests br
        JOIN public.club_members cm ON cm.club_id = br.club_id
        WHERE br.id = budget_line_items.budget_request_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Club admins can create line items (for their own budget request).
DROP POLICY IF EXISTS "Club admins can create line items." ON public.budget_line_items;
CREATE POLICY "Club admins can create line items."
ON public.budget_line_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.budget_requests br
        JOIN public.club_members cm ON cm.club_id = br.club_id
        WHERE br.id = budget_line_items.budget_request_id
          AND cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'approved'
    )
);

-- Only admins can update line items (approve/reject individual items).
DROP POLICY IF EXISTS "Admins can update line items." ON public.budget_line_items;
CREATE POLICY "Admins can update line items."
ON public.budget_line_items FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Audit log: admins can view all, clubs can view their own.
DROP POLICY IF EXISTS "Clubs can view their audit logs." ON public.budget_approval_audit_log;
CREATE POLICY "Clubs can view their audit logs."
ON public.budget_approval_audit_log FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.budget_requests br
        JOIN public.club_members cm ON cm.club_id = br.club_id
        WHERE br.id = budget_approval_audit_log.budget_request_id
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Only admins can insert audit log entries.
DROP POLICY IF EXISTS "Admins can insert audit logs." ON public.budget_approval_audit_log;
CREATE POLICY "Admins can insert audit logs."
ON public.budget_approval_audit_log FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ── Step 6: submit_budget_request RPC ──────────────────────────
-- Atomically creates a budget request + line items, and marks the
-- event as requiring funding (which blocks publication).
CREATE OR REPLACE FUNCTION public.submit_budget_request(
    p_event_id UUID,
    p_club_id UUID,
    p_requested_by UUID,
    p_line_items JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_request_id UUID;
    v_total_requested DECIMAL(10, 2) := 0.00;
    v_item JSONB;
BEGIN
    -- Mark the event as requiring funding (blocks publication).
    UPDATE public.events
    SET requires_funding = TRUE
    WHERE id = p_event_id;

    -- Calculate total requested from line items.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
    LOOP
        v_total_requested := v_total_requested + (v_item->>'requested_amount')::DECIMAL(10, 2);
    END LOOP;

    -- Insert the budget request.
    INSERT INTO public.budget_requests
        (event_id, club_id, requested_by, status, total_requested)
    VALUES
        (p_event_id, p_club_id, p_requested_by, 'pending', v_total_requested)
    RETURNING id INTO v_request_id;

    -- Insert line items.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
    LOOP
        INSERT INTO public.budget_line_items
            (budget_request_id, description, category, requested_amount, quote_pdf_url)
        VALUES
            (v_request_id,
             v_item->>'description',
             COALESCE(v_item->>'category', 'general'),
             (v_item->>'requested_amount')::DECIMAL(10, 2),
             v_item->>'quote_pdf_url');
    END LOOP;

    -- Insert audit log entry.
    INSERT INTO public.budget_approval_audit_log
        (budget_request_id, action, previous_status, new_status, performed_by)
    VALUES
        (v_request_id, 'submit', NULL, 'pending', p_requested_by);

    RETURN v_request_id;
END;
 $$;

-- ── Step 7: approve_budget_request RPC ────────────────────────
-- Approves the entire request. Sets all line items to 'approved' with
-- approved_amount = requested_amount. Also supports partial approvals
-- via the approve_line_item RPC (below).
CREATE OR REPLACE FUNCTION public.approve_budget_request(
    p_request_id UUID,
    p_admin_id UUID,
    p_comment TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_previous_status TEXT;
    v_total_approved DECIMAL(10, 2) := 0.00;
BEGIN
    SELECT status INTO v_previous_status
    FROM public.budget_requests WHERE id = p_request_id FOR UPDATE;

    IF v_previous_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Budget request not found.');
    END IF;

    -- Approve all pending line items.
    UPDATE public.budget_line_items
    SET status = 'approved', approved_amount = requested_amount
    WHERE budget_request_id = p_request_id AND status = 'pending';

    -- Calculate total approved.
    SELECT COALESCE(SUM(approved_amount), 0.00)
    INTO v_total_approved
    FROM public.budget_line_items
    WHERE budget_request_id = p_request_id AND status = 'approved';

    -- Update request status.
    UPDATE public.budget_requests
    SET status = 'approved', total_approved = v_total_approved, admin_comment = p_comment, updated_at = NOW()
    WHERE id = p_request_id;

    -- Audit log.
    INSERT INTO public.budget_approval_audit_log
        (budget_request_id, action, previous_status, new_status, comment, performed_by)
    VALUES (p_request_id, 'approve', v_previous_status, 'approved', p_comment, p_admin_id);

    RETURN jsonb_build_object('success', true, 'total_approved', v_total_approved);
END;
 $$;

-- ── Step 8: reject_budget_request RPC ─────────────────────────
CREATE OR REPLACE FUNCTION public.reject_budget_request(
    p_request_id UUID,
    p_admin_id UUID,
    p_comment TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_previous_status TEXT;
BEGIN
    SELECT status INTO v_previous_status
    FROM public.budget_requests WHERE id = p_request_id FOR UPDATE;

    IF v_previous_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Budget request not found.');
    END IF;

    UPDATE public.budget_requests
    SET status = 'rejected', admin_comment = p_comment, updated_at = NOW()
    WHERE id = p_request_id;

    INSERT INTO public.budget_approval_audit_log
        (budget_request_id, action, previous_status, new_status, comment, performed_by)
    VALUES (p_request_id, 'reject', v_previous_status, 'rejected', p_comment, p_admin_id);

    RETURN jsonb_build_object('success', true);
END;
 $$;

-- ── Step 9: request_budget_changes RPC ────────────────────────
CREATE OR REPLACE FUNCTION public.request_budget_changes(
    p_request_id UUID,
    p_admin_id UUID,
    p_comment TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_previous_status TEXT;
BEGIN
    SELECT status INTO v_previous_status
    FROM public.budget_requests WHERE id = p_request_id FOR UPDATE;

    IF v_previous_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Budget request not found.');
    END IF;

    UPDATE public.budget_requests
    SET status = 'changes_requested', admin_comment = p_comment, updated_at = NOW()
    WHERE id = p_request_id;

    INSERT INTO public.budget_approval_audit_log
        (budget_request_id, action, previous_status, new_status, comment, performed_by)
    VALUES (p_request_id, 'request_changes', v_previous_status, 'changes_requested', p_comment, p_admin_id);

    RETURN jsonb_build_object('success', true);
END;
 $$;

-- ── Step 10: approve_line_item RPC (partial approval) ──────────
-- Allows the admin to approve/modify/reject individual line items.
CREATE OR REPLACE FUNCTION public.approve_line_item(
    p_line_item_id UUID,
    p_admin_id UUID,
    p_action TEXT,
    p_approved_amount DECIMAL(10, 2) DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_item RECORD;
    v_new_status TEXT;
BEGIN
    SELECT * INTO v_item FROM public.budget_line_items WHERE id = p_line_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Line item not found.');
    END IF;

    IF p_action = 'approve' THEN
        v_new_status := 'approved';
        UPDATE public.budget_line_items
        SET status = 'approved', approved_amount = COALESCE(p_approved_amount, requested_amount)
        WHERE id = p_line_item_id;
    ELSIF p_action = 'reject' THEN
        v_new_status := 'rejected';
        UPDATE public.budget_line_items
        SET status = 'rejected', approved_amount = 0.00
        WHERE id = p_line_item_id;
    ELSIF p_action = 'modify' THEN
        v_new_status := 'modified';
        UPDATE public.budget_line_items
        SET status = 'modified', approved_amount = p_approved_amount
        WHERE id = p_line_item_id;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action.');
    END IF;

    -- Recalculate total_approved on the parent request.
    UPDATE public.budget_requests
    SET total_approved = (
        SELECT COALESCE(SUM(approved_amount), 0.00)
        FROM public.budget_line_items
        WHERE budget_request_id = v_item.budget_request_id
          AND status IN ('approved', 'modified')
    ), updated_at = NOW()
    WHERE id = v_item.budget_request_id;

    -- Audit log.
    INSERT INTO public.budget_approval_audit_log
        (budget_request_id, line_item_id, action, previous_status, new_status, performed_by)
    VALUES (v_item.budget_request_id, p_line_item_id, 'modify_line_item', v_item.status, v_new_status, p_admin_id);

    RETURN jsonb_build_object('success', true, 'new_status', v_new_status);
END;
 $$;

-- ── Step 11: Publication guard trigger ─────────────────────────
-- Prevents an event from being set to 'published' if requires_funding
-- is TRUE and the budget request is not 'approved'.
CREATE OR REPLACE FUNCTION public.prevent_publish_without_funding_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_budget_status TEXT;
BEGIN
    IF NEW.status = 'published' AND NEW.requires_funding = TRUE THEN
        SELECT status INTO v_budget_status
        FROM public.budget_requests
        WHERE event_id = NEW.id
        ORDER BY created_at DESC LIMIT 1;

        IF v_budget_status IS NULL OR v_budget_status != 'approved' THEN
            RAISE EXCEPTION 'Event cannot be published: budget request is not approved (current: %).',
                COALESCE(v_budget_status, 'none');
        END IF;
    END IF;

    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS on_event_publish_check ON public.events;
CREATE TRIGGER on_event_publish_check
BEFORE UPDATE OF status ON public.events
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'published')
EXECUTE FUNCTION public.prevent_publish_without_funding_approval();

COMMENT ON TABLE public.budget_requests IS
'Budget requests submitted by clubs for event funding. Issue #2897.';
COMMENT ON TABLE public.budget_line_items IS
'Itemized line items for budget requests. Supports partial approvals. Issue #2897.';
COMMENT ON TABLE public.budget_approval_audit_log IS
'Audit log for all budget request status changes. Issue #2897.';

-- ============================================================
-- End of migration
-- ============================================================
