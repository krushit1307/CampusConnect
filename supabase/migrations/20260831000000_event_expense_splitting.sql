CREATE TABLE IF NOT EXISTS event_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    payer_club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    total_amount NUMERIC NOT NULL,
    description TEXT NOT NULL,
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE expense_split_status AS ENUM ('pending', 'paid', 'disputed');

CREATE TABLE IF NOT EXISTS expense_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID REFERENCES event_expenses(id) ON DELETE CASCADE,
    owing_club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    owed_amount NUMERIC NOT NULL,
    status expense_split_status NOT NULL DEFAULT 'pending',
    dispute_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for event_expenses
ALTER TABLE event_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club officers can view expenses for their events" 
    ON event_expenses FOR SELECT 
    USING (
        event_id IN (
            SELECT id FROM events 
            WHERE host_club_id IN (
                SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'officer')
            )
        )
    );

CREATE POLICY "Club officers can insert expenses for their events" 
    ON event_expenses FOR INSERT 
    WITH CHECK (
        payer_club_id IN (
            SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'officer')
        )
    );

-- RLS for expense_splits
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club officers can view splits related to their club" 
    ON expense_splits FOR SELECT 
    USING (
        owing_club_id IN (
            SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'officer')
        ) OR 
        expense_id IN (
            SELECT id FROM event_expenses WHERE payer_club_id IN (
                SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'officer')
            )
        )
    );

CREATE POLICY "Club officers can insert splits for their expenses" 
    ON expense_splits FOR INSERT 
    WITH CHECK (
        expense_id IN (
            SELECT id FROM event_expenses WHERE payer_club_id IN (
                SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'officer')
            )
        )
    );

CREATE POLICY "Club officers can update splits they owe (mark paid/dispute)" 
    ON expense_splits FOR UPDATE 
    USING (
        owing_club_id IN (
            SELECT club_id FROM club_members WHERE user_id = auth.uid() AND role IN ('owner', 'officer')
        )
    );
