-- Issue #4044 / #4150: accessibility profile flag.
--
-- `requires_wheelchair_access` drives the accessibility-aware router: when
-- true, route calculation strictly avoids walkways tagged with steps or
-- steep inclines and demotes edges that depend on facilities flagged broken
-- by the crowdsourced reporting API.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS requires_wheelchair_access BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.requires_wheelchair_access IS
  'When true, campus routing must avoid stairs/steep inclines (Issues #4044, #4150)';
