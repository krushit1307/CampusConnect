ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS social_links_order JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_clubs_social_links_order_is_array'
    ) THEN
        ALTER TABLE public.clubs
        ADD CONSTRAINT check_clubs_social_links_order_is_array
        CHECK (jsonb_typeof(social_links_order) = 'array');
    END IF;
END $$;