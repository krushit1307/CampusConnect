-- Add tracking for admin role changes
ALTER TABLE public.club_memberships ADD COLUMN IF NOT EXISTS admin_promoted_at TIMESTAMPTZ;

-- Trigger to track admin promotion
CREATE OR REPLACE FUNCTION track_admin_promotion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'admin' AND OLD.role != 'admin' THEN
        INSERT INTO public.admin_promotion_events (user_id, club_id, promoted_at)
        VALUES (NEW.user_id, NEW.club_id, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_promotion_trigger ON public.club_memberships;
CREATE TRIGGER admin_promotion_trigger
AFTER UPDATE ON public.club_memberships
FOR EACH ROW
EXECUTE FUNCTION track_admin_promotion();