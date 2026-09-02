-- Migration for Dynamic "Mental Health" Thermal Overcrowding Detection (Acoustic Density Triangulation) (#5305)

CREATE TABLE IF NOT EXISTS public.acoustic_crush_alarms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id TEXT NOT NULL,
    estimated_density INTEGER NOT NULL,
    room_capacity INTEGER NOT NULL,
    db_level NUMERIC NOT NULL,
    hazard_level TEXT NOT NULL CHECK (hazard_level IN ('SAFE', 'WARNING', 'CRITICAL_CRUSH_HAZARD')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.acoustic_crush_alarms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Security Admins can view crush alarms" 
ON public.acoustic_crush_alarms 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role
    )
);
