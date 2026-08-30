-- =============================================================================
-- Migration: 20270905000000_campus_safety_lorawan_fallback.sql
-- Description: Issue #4998 - Off-grid LoRaWAN Access Control Fallback for lockdown
-- =============================================================================

BEGIN;

-- 1. Create exterior_doors table
CREATE TABLE IF NOT EXISTS public.exterior_doors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building TEXT NOT NULL,
    door_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'LOCKED', 'LOCKED_BY_LORA')) DEFAULT 'OPEN',
    rest_endpoint_url TEXT NOT NULL,
    lora_device_eui VARCHAR(16) NOT NULL,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create lorawan_gateways table
CREATE TABLE IF NOT EXISTS public.lorawan_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_name TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ONLINE', 'OFFLINE')) DEFAULT 'ONLINE',
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create lorawan_transmissions table
CREATE TABLE IF NOT EXISTS public.lorawan_transmissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_id UUID REFERENCES public.lorawan_gateways(id) ON DELETE SET NULL,
    building TEXT NOT NULL,
    command TEXT NOT NULL DEFAULT 'LOCK_ALL',
    encrypted_payload TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('TRANSMITTED', 'FAILED')) DEFAULT 'TRANSMITTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes for quick lookup during emergency
CREATE INDEX IF NOT EXISTS idx_exterior_doors_building ON public.exterior_doors(building);
CREATE INDEX IF NOT EXISTS idx_lorawan_transmissions_gateway ON public.lorawan_transmissions(gateway_id);
CREATE INDEX IF NOT EXISTS idx_lorawan_transmissions_created ON public.lorawan_transmissions(created_at DESC);

-- 5. Row Level Security Policies
ALTER TABLE public.exterior_doors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lorawan_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lorawan_transmissions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view doors and gateways
CREATE POLICY "Allow authenticated users to read doors"
ON public.exterior_doors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read gateways"
ON public.lorawan_gateways FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read transmissions"
ON public.lorawan_transmissions FOR SELECT TO authenticated USING (true);

-- Allow service_role / system_admin to manage doors and transmissions
CREATE POLICY "Admins can manage exterior doors"
ON public.exterior_doors FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
);

CREATE POLICY "Admins can manage gateways"
ON public.lorawan_gateways FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
);

CREATE POLICY "Admins can manage transmissions"
ON public.lorawan_transmissions FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
);

-- 6. Insert Default Gateways
INSERT INTO public.lorawan_gateways (gateway_name, location, status)
VALUES 
  ('Central Campus Tower Transmitter', 'Main Tower Roof, 150m AGL', 'ONLINE'),
  ('North Campus Mast Transmitter', 'Science Park Mast, 90m AGL', 'ONLINE')
ON CONFLICT DO NOTHING;

-- 7. Insert Default exterior_doors
INSERT INTO public.exterior_doors (building, door_name, status, rest_endpoint_url, lora_device_eui)
VALUES
  ('Science Building', 'North Lobby Main Entrance', 'OPEN', 'http://doors.science.campus.local/north/lock', '0018b20000000001'),
  ('Science Building', 'South Lecture Hall Entrance', 'OPEN', 'http://doors.science.campus.local/south/lock', '0018b20000000002'),
  ('Main Library', 'East Quad Entrance', 'OPEN', 'http://doors.library.campus.local/east/lock', '0018b20000000003'),
  ('Student Union', 'Food Court Door A', 'OPEN', 'http://doors.union.campus.local/foodcourt/lock', '0018b20000000004')
ON CONFLICT DO NOTHING;

COMMIT;
