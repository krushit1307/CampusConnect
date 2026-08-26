-- Migration: Add unique constraint to event_feedbacks table
-- Ensures that a user can only submit one feedback per event.

ALTER TABLE public.event_feedbacks 
ADD CONSTRAINT unique_event_feedback UNIQUE (event_id, user_id);
