-- Migration: 20261231000017_event_vibe_check_sentiment.sql
-- Description: Real-Time Event "Vibe Check" Sentiment Analysis (#3596)

-- 1. Create table for aggregated sentiment window snapshots
CREATE TABLE IF NOT EXISTS public.event_sentiment_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    happy_count INT NOT NULL DEFAULT 0,
    confused_count INT NOT NULL DEFAULT 0,
    neutral_count INT NOT NULL DEFAULT 0,
    engaged_count INT NOT NULL DEFAULT 0,
    surprised_count INT NOT NULL DEFAULT 0,
    bored_count INT NOT NULL DEFAULT 0,
    total_samples INT NOT NULL DEFAULT 0,
    dominant_emotion TEXT NOT NULL DEFAULT 'Neutral'
);

CREATE INDEX IF NOT EXISTS idx_event_sentiment_event_time
ON public.event_sentiment_snapshots(event_id, timestamp DESC);

-- Enable RLS
ALTER TABLE public.event_sentiment_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sentiment snapshots for events"
ON public.event_sentiment_snapshots FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert sentiment snapshots"
ON public.event_sentiment_snapshots FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Function to aggregate and record sentiment window
CREATE OR REPLACE FUNCTION public.record_event_sentiment(
    p_event_id UUID,
    p_happy INT,
    p_confused INT,
    p_neutral INT,
    p_engaged INT,
    p_surprised INT DEFAULT 0,
    p_bored INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total INT;
    v_dominant TEXT := 'Neutral';
    v_max INT := p_neutral;
    v_result JSONB;
BEGIN
    v_total := p_happy + p_confused + p_neutral + p_engaged + p_surprised + p_bored;
    
    IF p_happy > v_max THEN
        v_dominant := 'Happy';
        v_max := p_happy;
    END IF;
    IF p_confused > v_max THEN
        v_dominant := 'Confused';
        v_max := p_confused;
    END IF;
    IF p_engaged > v_max THEN
        v_dominant := 'Engaged';
        v_max := p_engaged;
    END IF;
    IF p_surprised > v_max THEN
        v_dominant := 'Surprised';
        v_max := p_surprised;
    END IF;
    IF p_bored > v_max THEN
        v_dominant := 'Bored';
        v_max := p_bored;
    END IF;

    INSERT INTO public.event_sentiment_snapshots (
        event_id,
        timestamp,
        happy_count,
        confused_count,
        neutral_count,
        engaged_count,
        surprised_count,
        bored_count,
        total_samples,
        dominant_emotion
    )
    VALUES (
        p_event_id,
        NOW(),
        p_happy,
        p_confused,
        p_neutral,
        p_engaged,
        p_surprised,
        p_bored,
        v_total,
        v_dominant
    );

    v_result := jsonb_build_object(
        'event_id', p_event_id,
        'total_samples', v_total,
        'dominant_emotion', v_dominant
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_event_sentiment TO authenticated, anon;
