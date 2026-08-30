CREATE TABLE IF NOT EXISTS public.standard_taxonomy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES public.standard_taxonomy(id),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.custom_tag_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    custom_tag TEXT NOT NULL UNIQUE,
    standard_taxonomy_id UUID NOT NULL REFERENCES public.standard_taxonomy(id)
);

-- Basic data
INSERT INTO public.standard_taxonomy (id, name) VALUES 
('11111111-1111-1111-1111-111111111111', 'STEM') ON CONFLICT DO NOTHING;

INSERT INTO public.standard_taxonomy (id, parent_id, name) VALUES 
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Computer Science') ON CONFLICT DO NOTHING;

INSERT INTO public.standard_taxonomy (id, parent_id, name) VALUES 
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Web Development') ON CONFLICT DO NOTHING;

-- Policies
ALTER TABLE public.standard_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_tag_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on standard_taxonomy" ON public.standard_taxonomy FOR SELECT USING (true);
CREATE POLICY "Allow public read on custom_tag_mappings" ON public.custom_tag_mappings FOR SELECT USING (true);
CREATE POLICY "Allow public insert on custom_tag_mappings" ON public.custom_tag_mappings FOR INSERT WITH CHECK (true);
