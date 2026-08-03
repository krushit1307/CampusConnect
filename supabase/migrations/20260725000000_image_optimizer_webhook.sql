-- Enable pg_net if available
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname='pg_net'
    ) THEN
        CREATE EXTENSION pg_net
        WITH SCHEMA extensions;
    END IF;
EXCEPTION
WHEN OTHERS THEN
    NULL;
END $$;


CREATE OR REPLACE FUNCTION public.handle_storage_image_upload()
RETURNS trigger
AS $$
DECLARE
    payload jsonb;
    function_url text := 'http://localhost:54321/functions/v1/image-optimizer';
BEGIN

    payload := jsonb_build_object(
        'bucket_id', NEW.bucket_id,
        'name', NEW.name
    );

    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n
        ON p.pronamespace=n.oid
        WHERE p.proname='http_post'
        AND n.nspname='net'
    ) THEN

        PERFORM net.http_post(
            url := function_url,
            headers := '{"Content-Type":"application/json"}'::jsonb,
            body := payload
        );

    ELSIF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n
        ON p.pronamespace=n.oid
        WHERE p.proname='http_post'
        AND n.nspname='extensions'
    ) THEN

        PERFORM extensions.http_post(
            url := function_url,
            headers := '{"Content-Type":"application/json"}'::jsonb,
            body := payload
        );

    END IF;

    RETURN NEW;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;


DROP TRIGGER IF EXISTS image_optimizer_trigger
ON storage.objects;


CREATE TRIGGER image_optimizer_trigger
AFTER INSERT
ON storage.objects
FOR EACH ROW
WHEN (
    NEW.bucket_id IN (
        'avatars',
        'club-banners',
        'event-banners'
    )
    AND NEW.name IS NOT NULL
    AND NEW.name NOT LIKE '%-thumb.%'
)
EXECUTE FUNCTION public.handle_storage_image_upload();