-- Accessibility Audits for Venues (Issue #2985)

CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    building TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    accessibility_features JSONB NOT NULL DEFAULT '{"has_elevator": false, "wheelchair_ramp": false, "gender_neutral_restrooms": false, "hearing_loop": false, "low_sensory_zone": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure JSONB structure is valid
ALTER TABLE venues
ADD CONSTRAINT venues_accessibility_valid
CHECK (
    jsonb_typeof(accessibility_features) = 'object'
    AND accessibility_features ? 'has_elevator'
    AND accessibility_features ? 'wheelchair_ramp'
    AND accessibility_features ? 'gender_neutral_restrooms'
    AND accessibility_features ? 'hearing_loop'
    AND accessibility_features ? 'low_sensory_zone'
    AND jsonb_typeof(accessibility_features->'has_elevator') = 'boolean'
    AND jsonb_typeof(accessibility_features->'wheelchair_ramp') = 'boolean'
    AND jsonb_typeof(accessibility_features->'gender_neutral_restrooms') = 'boolean'
    AND jsonb_typeof(accessibility_features->'hearing_loop') = 'boolean'
    AND jsonb_typeof(accessibility_features->'low_sensory_zone') = 'boolean'
);

ALTER TABLE events
ADD COLUMN venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
ADD COLUMN accessibility_features JSONB;

-- For custom venue events, accessibility_features must be provided
ALTER TABLE events
ADD CONSTRAINT events_custom_venue_accessibility
CHECK (
    (venue_id IS NOT NULL) OR
    (location IS NULL OR location = '') OR
    (location = 'Online' OR location = 'online') OR
    (
        venue_id IS NULL AND location IS NOT NULL AND location != '' AND location != 'Online' AND location != 'online' AND
        accessibility_features IS NOT NULL AND
        jsonb_typeof(accessibility_features) = 'object' AND
        accessibility_features ? 'has_elevator' AND
        accessibility_features ? 'wheelchair_ramp' AND
        accessibility_features ? 'gender_neutral_restrooms' AND
        accessibility_features ? 'hearing_loop' AND
        accessibility_features ? 'low_sensory_zone'
    )
);

CREATE TABLE venue_accessibility_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    feature TEXT NOT NULL CHECK (feature IN ('has_elevator', 'wheelchair_ramp', 'gender_neutral_restrooms', 'hearing_loop', 'low_sensory_zone')),
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accessibility_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    feature TEXT NOT NULL CHECK (feature IN ('has_elevator', 'wheelchair_ramp', 'gender_neutral_restrooms', 'hearing_loop', 'low_sensory_zone')),
    description TEXT NOT NULL,
    reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venues are viewable by everyone." ON venues FOR SELECT USING (true);
CREATE POLICY "System admins can insert venues." ON venues FOR INSERT TO authenticated WITH CHECK (public.is_system_admin());
CREATE POLICY "System admins can update venues." ON venues FOR UPDATE TO authenticated USING (public.is_system_admin());

ALTER TABLE venue_accessibility_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Overrides are viewable by everyone." ON venue_accessibility_overrides FOR SELECT USING (true);
-- To keep it simple, system admins can insert/update overrides. In a real scenario, event organizers using the venue might also have access.
CREATE POLICY "System admins can insert overrides." ON venue_accessibility_overrides FOR INSERT TO authenticated WITH CHECK (public.is_system_admin());
CREATE POLICY "System admins can update overrides." ON venue_accessibility_overrides FOR UPDATE TO authenticated USING (public.is_system_admin());

ALTER TABLE accessibility_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System admins can view reports." ON accessibility_reports FOR SELECT TO authenticated USING (public.is_system_admin());
CREATE POLICY "Authenticated users can submit reports." ON accessibility_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE TRIGGER set_updated_at_venues
BEFORE UPDATE ON venues
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
