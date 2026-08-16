-- Migration: Create user_availability table for Smart Conflict Scheduler
CREATE TABLE IF NOT EXISTS public.user_availability (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    slot_index SMALLINT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT user_availability_pkey PRIMARY KEY (user_id, day_of_week, slot_index),
    CONSTRAINT valid_day_of_week CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT valid_slot_index CHECK (slot_index BETWEEN 0 AND 27)
);

-- Enable RLS
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own availability
CREATE POLICY "Users can manage their own availability" 
ON public.user_availability 
FOR ALL 
USING (auth.uid() = user_id);

-- Policy: Anyone can read availability (needed for scheduling)
CREATE POLICY "Anyone can read user availability" 
ON public.user_availability 
FOR SELECT 
USING (true);

-- Add an index for faster lookups when scheduling
CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON public.user_availability(user_id);
