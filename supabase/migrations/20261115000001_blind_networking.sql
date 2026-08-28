-- =============================================================================
-- Migration: Dynamic "Blind Networking" Matchmaker
-- Issue: #3697 - Develop a 'Dynamic "Blind Networking" Matchmaker'
-- Description: Opt-in cross-disciplinary networking. Users toggle availability,
-- the matcher pairs them with someone from a DIFFERENT department, provisions a
-- DM channel and seeds icebreaker prompts. Includes a safety/report path.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Networking preferences (opt-in availability)
CREATE TABLE IF NOT EXISTS public.networking_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_times TEXT[] NOT NULL DEFAULT '{}',
  coffee_chat_bio TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Matches between two users (ordered so user_a < user_b to dedupe pairs)
CREATE TABLE IF NOT EXISTS public.networking_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID,
  icebreakers TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'declined', 'reported')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_a, user_b),
  CHECK (user_a <> user_b)
);

CREATE INDEX IF NOT EXISTS idx_networking_matches_user
ON public.networking_matches (user_a);

-- =============================================================================
-- RPC: Match two users from DIFFERENT majors (strict constraint) inside a
-- transaction. Returns the new match id or NULL if no eligible partner exists.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_blind_networking_match(
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_major TEXT;
  v_partner_id UUID;
  v_match_id UUID;
BEGIN
  -- 1. Read the requester's major
  SELECT major INTO v_major FROM public.profiles WHERE id = p_user_id;

  -- 2. Find an active partner from a STRICTLY DIFFERENT department who we
  --    have not already been matched with.
  SELECT np.user_id INTO v_partner_id
  FROM public.networking_preferences np
  JOIN public.profiles pp ON pp.id = np.user_id
  WHERE np.is_active = TRUE
    AND np.user_id <> p_user_id
    AND COALESCE(pp.major, '') <> COALESCE(v_major, '__none__')   -- cross-discipline rule
    AND NOT EXISTS (
      SELECT 1 FROM public.networking_matches m
      WHERE (m.user_a = p_user_id AND m.user_b = np.user_id)
         OR (m.user_a = np.user_id AND m.user_b = p_user_id)
    )
  ORDER BY random()
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3. Atomic insert: create the match record (DM channel + bot message are
  --    provisioned by the calling Edge Function using the returned id).
  INSERT INTO public.networking_matches (user_a, user_b, icebreakers)
  VALUES (
    LEAST(p_user_id, v_partner_id),
    GREATEST(p_user_id, v_partner_id),
    ARRAY[
      'What is a project outside your major that you are proud of?',
      'If our two fields collaborated, what would you build together?',
      'What is one skill from your discipline you wish more people understood?'
    ]
  )
  RETURNING id INTO v_match_id;

  RETURN v_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.networking_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.networking_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own networking preferences"
ON public.networking_preferences FOR ALL
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own matches"
ON public.networking_matches FOR SELECT
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users update own matches"
ON public.networking_matches FOR UPDATE
USING (auth.uid() = user_a OR auth.uid() = user_b);
