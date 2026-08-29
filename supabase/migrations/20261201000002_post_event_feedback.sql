-- =============================================================================
-- Migration: Automated "Post-Event Feedback" Aggregation
-- Issue: #4042 - Implement 'Automated "Post-Event Feedback" Aggregation'
-- Description: Creates tables for event feedback and adds an aggregate_rating 
-- column to the clubs table, updated automatically via trigger.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Event Feedback Table
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable for 1-click email links
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id) -- One rating per user per event
);

CREATE INDEX IF NOT EXISTS idx_event_feedback_event ON public.event_feedback(event_id);

-- 2. Add aggregate rating to clubs table
ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS aggregate_rating NUMERIC(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_reviews INT DEFAULT 0;

-- 3. Trigger function to update club aggregate rating
CREATE OR REPLACE FUNCTION public.update_club_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_club_id UUID;
  v_avg_rating NUMERIC;
  v_total INT;
BEGIN
  -- Get the club_id from the event
  SELECT club_id INTO v_club_id FROM public.events WHERE id = NEW.event_id;
  
  IF v_club_id IS NOT NULL THEN
    -- Calculate new average and total
    SELECT AVG(rating)::NUMERIC(3,2), COUNT(*) 
    INTO v_avg_rating, v_total
    FROM public.event_feedback ef
    JOIN public.events e ON ef.event_id = e.id
    WHERE e.club_id = v_club_id;

    UPDATE public.clubs 
    SET aggregate_rating = COALESCE(v_avg_rating, 0.00),
        total_reviews = COALESCE(v_total, 0)
    WHERE id = v_club_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach trigger
DROP TRIGGER IF EXISTS trg_update_club_rating ON public.event_feedback;
CREATE TRIGGER trg_update_club_rating
AFTER INSERT OR UPDATE OR DELETE ON public.event_feedback
FOR EACH ROW EXECUTE FUNCTION public.update_club_rating();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can submit feedback (unauthenticated via secure token or authenticated)
CREATE POLICY "Anyone can submit feedback"
ON public.event_feedback FOR INSERT WITH CHECK (true);

-- Anyone can view aggregate feedback (read-only)
CREATE POLICY "Public can view feedback"
ON public.event_feedback FOR SELECT USING (true);
