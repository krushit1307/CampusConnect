-- Migration: Add event-gallery storage bucket and policies
-- Description: Configures event-gallery bucket for event photo storage and adds RLS policies.

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-gallery', 'event-gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for event-gallery bucket
DROP POLICY IF EXISTS "Public Access Event Gallery" ON storage.objects;
CREATE POLICY "Public Access Event Gallery" ON storage.objects
FOR SELECT USING (bucket_id = 'event-gallery');

DROP POLICY IF EXISTS "Club admins can upload event gallery" ON storage.objects;
CREATE POLICY "Club admins can upload event gallery" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'event-gallery' AND
    auth.role() = 'authenticated' AND
    CASE
      WHEN array_length(storage.foldername(name), 1) >= 1
           AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (
        public.is_club_admin((SELECT club_id FROM public.events WHERE id = (storage.foldername(name))[1]::uuid), auth.uid()) OR
        EXISTS (SELECT 1 FROM public.events WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid())
      )
      ELSE true
    END
);

DROP POLICY IF EXISTS "Club admins can update event gallery" ON storage.objects;
CREATE POLICY "Club admins can update event gallery" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'event-gallery' AND
    auth.role() = 'authenticated' AND
    CASE
      WHEN array_length(storage.foldername(name), 1) >= 1
           AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (
        public.is_club_admin((SELECT club_id FROM public.events WHERE id = (storage.foldername(name))[1]::uuid), auth.uid()) OR
        EXISTS (SELECT 1 FROM public.events WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid())
      )
      ELSE true
    END
);

DROP POLICY IF EXISTS "Club admins can delete event gallery" ON storage.objects;
CREATE POLICY "Club admins can delete event gallery" ON storage.objects
FOR DELETE USING (
    bucket_id = 'event-gallery' AND
    auth.role() = 'authenticated' AND
    CASE
      WHEN array_length(storage.foldername(name), 1) >= 1
           AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (
        public.is_club_admin((SELECT club_id FROM public.events WHERE id = (storage.foldername(name))[1]::uuid), auth.uid()) OR
        EXISTS (SELECT 1 FROM public.events WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid())
      )
      ELSE true
    END
);
