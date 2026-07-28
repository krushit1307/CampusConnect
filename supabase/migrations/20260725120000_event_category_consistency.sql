ALTER TABLE public.event_categories
ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

UPDATE public.event_categories SET display_order = 1 WHERE name = 'Tech';
UPDATE public.event_categories SET display_order = 2 WHERE name = 'Workshop';
UPDATE public.event_categories SET display_order = 3 WHERE name = 'Seminar';
UPDATE public.event_categories SET display_order = 4 WHERE name = 'Cultural';
UPDATE public.event_categories SET display_order = 5 WHERE name = 'Sports';
UPDATE public.event_categories SET display_order = 6 WHERE name = 'Career';
UPDATE public.event_categories SET display_order = 7 WHERE name = 'Community';
