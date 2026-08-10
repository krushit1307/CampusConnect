-- Migration: 20260819000000_get_shared_clubs_rpc.sql
-- Description: Postgres RPC function to compute mutual connections / shared clubs between two users (#1564)

CREATE OR REPLACE FUNCTION public.get_shared_clubs(user_a UUID, user_b UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  logo_url TEXT,
  description TEXT,
  category TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.name,
    c.slug,
    c.logo_url,
    c.description,
    c.category
  FROM public.club_members cm1
  INNER JOIN public.club_members cm2 ON cm1.club_id = cm2.club_id
  INNER JOIN public.clubs c ON c.id = cm1.club_id
  WHERE cm1.user_id = user_a
    AND cm2.user_id = user_b
    AND cm1.status = 'approved'
    AND cm2.status = 'approved'
    AND c.deleted_at IS NULL
  ORDER BY c.name ASC;
$$;

-- Grant execution permissions to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_shared_clubs(UUID, UUID) TO authenticated, anon;

COMMENT ON FUNCTION public.get_shared_clubs(UUID, UUID) IS
'Computes the intersection of approved club memberships between user_a and user_b using an INNER JOIN on club_members.';
