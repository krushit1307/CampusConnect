-- Migration: 20270304000000_automated_content_warning_tagging.sql
-- Description: Add content_warnings column and trigger to automatically tag events based on keywords.

-- 1. Add content_warnings TEXT[] column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS content_warnings TEXT[] DEFAULT '{}'::TEXT[] NOT NULL;

-- 2. Create the auto-tag trigger function
CREATE OR REPLACE FUNCTION public.auto_tag_content_warnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_desc TEXT;
  v_warnings TEXT[] := '{}'::TEXT[];
BEGIN
  v_desc := LOWER(COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.title, ''));

  -- Detect Violence
  IF v_desc ~* '(violence|blood|gore|murder|fight|assault|weapon|gun|knife|shoot|kill|abuse)' THEN
    v_warnings := array_append(v_warnings, 'Violence');
  END IF;

  -- Detect Mental Health
  IF v_desc ~* '(suicide|depress|anxiety|ptsd|panic|self-harm|trauma)' THEN
    v_warnings := array_append(v_warnings, 'Mental Health');
  END IF;

  -- Detect Substance Abuse
  IF v_desc ~* '(alcohol|drug|smoke|substance|marijuana|weed|drink|beer|wine|cocaine|addict)' THEN
    v_warnings := array_append(v_warnings, 'Substance Abuse');
  END IF;

  -- Detect Flashing Lights
  IF v_desc ~* '(flash|strobe|photosens|epilepsy|seizure|flicker)' THEN
    v_warnings := array_append(v_warnings, 'Flashing Lights');
  END IF;

  NEW.content_warnings := v_warnings;
  RETURN NEW;
END;
$$;

-- 3. Create the BEFORE INSERT OR UPDATE trigger
DROP TRIGGER IF EXISTS trigger_auto_tag_content_warnings ON public.events;

CREATE TRIGGER trigger_auto_tag_content_warnings
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.auto_tag_content_warnings();
