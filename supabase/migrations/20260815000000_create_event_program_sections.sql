CREATE TABLE event_program_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL, -- Assuming there is an 'events' table this links to
    title TEXT NOT NULL,
    content_html TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: Add an index to make sorting by order fast
CREATE INDEX idx_event_program_sections_order ON event_program_sections(event_id, order_index);