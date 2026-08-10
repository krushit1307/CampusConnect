-- Create a helper function to check if the current user is a super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Clubs Policies
CREATE POLICY "Super Admins can view all clubs" ON public.clubs
    FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Super Admins can update all clubs" ON public.clubs
    FOR UPDATE USING (public.is_super_admin());

-- Update Events Policies
CREATE POLICY "Super Admins can view all events" ON public.events
    FOR SELECT USING (public.is_super_admin());

CREATE POLICY "Super Admins can update all events" ON public.events
    FOR UPDATE USING (public.is_super_admin());
