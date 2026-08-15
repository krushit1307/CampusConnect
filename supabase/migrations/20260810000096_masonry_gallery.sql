-- Create gallery_images table
CREATE TABLE IF NOT EXISTS public.gallery_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on gallery_images
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- Read policy: Anyone can read gallery images
DROP POLICY IF EXISTS "Gallery images are viewable by everyone." ON public.gallery_images;
CREATE POLICY "Gallery images are viewable by everyone."
ON public.gallery_images FOR SELECT
USING (true);

-- Seed gallery images with various aspect ratios
INSERT INTO public.gallery_images (url, width, height, caption)
VALUES
    ('https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop', 800, 533, 'Students working on code at the library hackathon'),
    ('https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop', 800, 600, 'Fine art class painting project'),
    ('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop', 800, 533, 'DJ set at the annual campus music fest'),
    ('https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=800&auto=format&fit=crop', 800, 533, 'Co-working space in the innovation hub'),
    ('https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=800&auto=format&fit=crop', 800, 600, 'Color palettes at the student art gallery'),
    ('https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop', 800, 533, 'Campus dance troupe performance rehearsal'),
    ('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=800&auto=format&fit=crop', 800, 533, 'Group study session in the central pavilion'),
    ('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=800&auto=format&fit=crop', 800, 533, 'Graduation day at the main lawns'),
    ('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop', 800, 1200, 'Tall clocktower landmark on campus'),
    ('https://images.unsplash.com/photo-1498243691581-b145c3f54a5c?q=80&w=800&auto=format&fit=crop', 800, 450, 'Spacious campus library study desks'),
    ('https://images.unsplash.com/photo-1527891751199-7225231a68dd?q=80&w=800&auto=format&fit=crop', 800, 1067, 'Scenic walking paths near North Campus'),
    ('https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=800&auto=format&fit=crop', 800, 1200, 'Student organization planning board')
ON CONFLICT DO NOTHING;
