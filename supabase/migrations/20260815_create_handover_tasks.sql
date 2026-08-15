CREATE TABLE handover_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL, -- Assuming club_id is a UUID in your DB
    completed_by UUID REFERENCES auth.users(id), -- Links to Supabase Auth
    drive_link TEXT NOT NULL,
    cash_box_location TEXT NOT NULL,
    stripe_confirmed BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending', -- 'pending', 'verified'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) so only club admins can see this
ALTER TABLE handover_tasks ENABLE ROW LEVEL SECURITY;
