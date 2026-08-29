-- 1. Create tournament_bracket_matches table for real-time live overlays
CREATE TABLE IF NOT EXISTS tournament_bracket_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL CHECK (round_number > 0),
    match_number INTEGER NOT NULL CHECK (match_number > 0),
    player1_name TEXT NOT NULL,
    player2_name TEXT NOT NULL,
    player1_score INTEGER DEFAULT 0 NOT NULL,
    player2_score INTEGER DEFAULT 0 NOT NULL,
    winner_name TEXT,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'live', 'completed')),
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(event_id, round_number, match_number)
);

-- Index for overlay real-time queries
CREATE INDEX IF NOT EXISTS idx_bracket_overlay_event ON tournament_bracket_matches(event_id, round_number);

-- Enable RLS & Realtime
ALTER TABLE tournament_bracket_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access for OBS browser sources
CREATE POLICY "Public read access for tournament overlay matches"
    ON tournament_bracket_matches FOR SELECT
    USING (TRUE);