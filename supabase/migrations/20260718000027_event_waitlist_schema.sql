-- Create Table to Support Event Waitlists

CREATE TABLE public.event_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

-- Policies for event_waitlist
-- Users can view the waitlist for events
CREATE POLICY "Waitlists are viewable by everyone." 
ON public.event_waitlist FOR SELECT 
USING (true);

-- Users can join the waitlist themselves
CREATE POLICY "Users can join the waitlist." 
ON public.event_waitlist FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can leave the waitlist themselves
CREATE POLICY "Users can leave the waitlist." 
ON public.event_waitlist FOR DELETE 
USING (auth.uid() = user_id);

-- System admins can manage waitlists
CREATE POLICY "System admins can insert waitlist entries." 
ON public.event_waitlist FOR INSERT 
WITH CHECK (public.is_system_admin());

CREATE POLICY "System admins can update waitlist entries." 
ON public.event_waitlist FOR UPDATE 
USING (public.is_system_admin());

CREATE POLICY "System admins can delete waitlist entries." 
ON public.event_waitlist FOR DELETE 
USING (public.is_system_admin());
