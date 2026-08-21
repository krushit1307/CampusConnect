-- Migration to support 'transcript' in event_resources

ALTER TABLE event_resources DROP CONSTRAINT IF EXISTS event_resources_resource_type_check;

ALTER TABLE event_resources ADD CONSTRAINT event_resources_resource_type_check 
CHECK (resource_type IN ('pdf', 'link', 'video', 'transcript'));

-- Ensure event-resources bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-resources', 'event-resources', true) 
ON CONFLICT (id) DO NOTHING;
