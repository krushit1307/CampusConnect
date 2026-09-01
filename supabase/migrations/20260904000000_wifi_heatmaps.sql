-- Migration for Interactive "Event Layout" Wi-Fi Heatmap Overlay (#4992)

-- Stores physical Access Point metadata synced from Cisco Meraki/Aruba
CREATE TABLE IF NOT EXISTS public.venue_access_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    mac_address TEXT UNIQUE NOT NULL,
    model TEXT DEFAULT 'Meraki MR46',
    x_pos NUMERIC(10, 2) NOT NULL, -- Coordinate on the 2D Layout Canvas (0-100%)
    y_pos NUMERIC(10, 2) NOT NULL,
    signal_radius_meters NUMERIC(10, 2) NOT NULL DEFAULT 15.0,
    status TEXT DEFAULT 'online',
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stores dynamic, drag-and-drop operational hardware locations for events
CREATE TABLE IF NOT EXISTS public.event_operational_hardware (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    hardware_type TEXT NOT NULL CHECK (hardware_type IN ('CHECK_IN_KIOSK', 'POS_TERMINAL', 'SCANNER', 'INFO_DESK')),
    x_pos NUMERIC(10, 2) NOT NULL,
    y_pos NUMERIC(10, 2) NOT NULL,
    rssi_status TEXT DEFAULT 'good', -- 'good' or 'critical_dead_zone'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.venue_access_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_operational_hardware ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view access points" ON public.venue_access_points FOR SELECT USING (true);
CREATE POLICY "Organizers can manage event hardware" ON public.event_operational_hardware FOR ALL USING (true);
