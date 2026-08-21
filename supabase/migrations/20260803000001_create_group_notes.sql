-- Create group_notes table
CREATE TABLE public.group_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    content TEXT,
    yjs_state BYTEA,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE (group_id) -- one collaborative note per club (for now)
);

-- Enable RLS
ALTER TABLE public.group_notes ENABLE ROW LEVEL SECURITY;

-- Policies for group_notes
-- Only members of the club can select the group note
CREATE POLICY "Club members can view group notes"
    ON public.group_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = group_notes.group_id
            AND club_members.user_id = auth.uid()
            AND club_members.status = 'approved'
        )
    );

-- Only members of the club can insert the group note
CREATE POLICY "Club members can insert group notes"
    ON public.group_notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = group_notes.group_id
            AND club_members.user_id = auth.uid()
            AND club_members.status = 'approved'
        )
    );

-- Only members of the club can update the group note
CREATE POLICY "Club members can update group notes"
    ON public.group_notes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = group_notes.group_id
            AND club_members.user_id = auth.uid()
            AND club_members.status = 'approved'
        )
    );
