-- Issue #4296: reserve a dedicated application role for verified peer listeners.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'peer_listener';
