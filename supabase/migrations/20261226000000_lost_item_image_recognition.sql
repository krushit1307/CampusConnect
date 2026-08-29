-- Migration: 20261226000000_lost_item_image_recognition.sql
-- Description: Create public lost-found bucket, sync trigger from lost_found_items to lost_items, and image recognition outbox triggers.

-- 1. Create public storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('lost-found', 'lost-found', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage bucket security policies
CREATE POLICY "Allow public select on lost-found photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'lost-found');

CREATE POLICY "Allow authenticated insert on lost-found photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'lost-found');

-- 3. Trigger to sync lost_found_items entries to lost_items table
CREATE OR REPLACE FUNCTION public.sync_lost_found_to_lost_items()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.lost_items (
            id,
            user_id,
            title,
            description,
            category,
            image_url,
            location_found,
            status,
            type,
            lat,
            lng
        ) VALUES (
            NEW.id,
            NEW.user_id,
            NEW.title,
            NEW.description,
            NEW.category,
            NEW.image_url,
            NEW.location,
            CASE WHEN NEW.status = 'active' THEN 'unclaimed' ELSE 'returned' END,
            NEW.type,
            NEW.lat,
            NEW.lng
        ) ON CONFLICT (id) DO NOTHING;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.lost_items
        SET
            title = NEW.title,
            description = NEW.description,
            category = NEW.category,
            image_url = NEW.image_url,
            location_found = NEW.location,
            status = CASE WHEN NEW.status = 'active' THEN 'unclaimed' ELSE 'returned' END,
            lat = NEW.lat,
            lng = NEW.lng
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_lost_found_to_lost_items ON public.lost_found_items;
CREATE TRIGGER trigger_sync_lost_found_to_lost_items
    AFTER INSERT OR UPDATE ON public.lost_found_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_lost_found_to_lost_items();

-- 4. Trigger to enqueue image processing outbox event when a found item with a photo is created
CREATE OR REPLACE FUNCTION public.enqueue_found_item_processing()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'found' AND NEW.image_url IS NOT NULL AND NEW.image_url <> '' THEN
        INSERT INTO public.outbox (table_name, action_type, record_id, record)
        VALUES ('lost_found_items', 'PROCESS_FOUND_IMAGE', NEW.id, row_to_json(NEW));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_found_item_image_process ON public.lost_found_items;
CREATE TRIGGER trigger_found_item_image_process
    AFTER INSERT ON public.lost_found_items
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_found_item_processing();
