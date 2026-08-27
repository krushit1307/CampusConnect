-- =============================================================================
-- Migration: Enforce aal2 (MFA) for financial data access
-- Issue: #2739 - Implement Multi-Factor Authentication (MFA) via TOTP
--
-- Description:
--   1. Adds an `auth_is_aal2()` helper that inspects the JWT's Authenticator
--      Assurance Level.
--   2. Tightens RLS on `transactions` and `budgets` so that club treasurers,
--      admins, and owners can only read/manage financial data once their
--      session is elevated to `aal2` (i.e. after completing a TOTP challenge).
--   3. Adds an `is_mfa_enforced_user()` RPC used by the frontend to decide
--      whether a signed-in user is a club executive / system admin who must
--      complete the `/mfa-challenge` step before continuing.
-- =============================================================================

-- 1. Helper: is the current session authenticated at Assurance Level 2?
CREATE OR REPLACE FUNCTION public.auth_is_aal2()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT auth.jwt() -> 'aal'), 'aal1') = 'aal2';
$$;

GRANT EXECUTE ON FUNCTION public.auth_is_aal2() TO authenticated;

-- 2. RLS on transactions: financial data requires an aal2 session.
DROP POLICY IF EXISTS "Transactions are viewable by club members and admins" ON public.transactions;
CREATE POLICY "Transactions are viewable by club members and admins"
  ON public.transactions FOR SELECT
  USING (
    public.auth_is_aal2()
    AND (
      EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = transactions.club_id
          AND user_id = auth.uid()
          AND status = 'approved'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Transactions are manageable by club admins" ON public.transactions;
CREATE POLICY "Transactions are manageable by club admins"
  ON public.transactions FOR INSERT
  WITH CHECK (
    public.auth_is_aal2()
    AND (
      EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = transactions.club_id
          AND user_id = auth.uid()
          AND role IN ('admin', 'owner')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Transactions updatable by club admins" ON public.transactions;
CREATE POLICY "Transactions updatable by club admins"
  ON public.transactions FOR UPDATE
  USING (
    public.auth_is_aal2()
    AND (
      EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = transactions.club_id
          AND user_id = auth.uid()
          AND role IN ('admin', 'owner')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
      )
    )
  );

-- 3. RLS on budgets: financial data requires an aal2 session.
DROP POLICY IF EXISTS "Budgets are viewable by club members and admins" ON public.budgets;
CREATE POLICY "Budgets are viewable by club members and admins"
  ON public.budgets FOR SELECT
  USING (
    public.auth_is_aal2()
    AND (
      EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = budgets.club_id
          AND user_id = auth.uid()
          AND status = 'approved'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Budgets are manageable by club admins" ON public.budgets;
CREATE POLICY "Budgets are manageable by club admins"
  ON public.budgets FOR INSERT
  WITH CHECK (
    public.auth_is_aal2()
    AND (
      EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = budgets.club_id
          AND user_id = auth.uid()
          AND role IN ('admin', 'owner')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
      )
    )
  );

DROP POLICY IF EXISTS "Budgets updatable by club admins" ON public.budgets;
CREATE POLICY "Budgets updatable by club admins"
  ON public.budgets FOR UPDATE
  USING (
    public.auth_is_aal2()
    AND (
      EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = budgets.club_id
          AND user_id = auth.uid()
          AND role IN ('admin', 'owner')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
      )
    )
  );

-- 4. RPC: is the signed-in user someone MFA must be enforced on?
-- Club executives (club admins/owners, club founders) and system admins are
-- required to complete a TOTP challenge, while regular members/students are not.
CREATE OR REPLACE FUNCTION public.is_mfa_enforced_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'owner', 'system_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'owner')
        AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.clubs
      WHERE created_by = auth.uid()
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_mfa_enforced_user() TO authenticated;
