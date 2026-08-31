BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(12);


-- ------------------------------------------------------------
-- Transition definition tests
-- ------------------------------------------------------------

SELECT ok(
  public.is_valid_attendance_transition(
    'rsvp',
    'confirmed'
  ),
  'RSVP can transition to confirmed'
);

SELECT ok(
  public.is_valid_attendance_transition(
    'confirmed',
    'checked_in'
  ),
  'Confirmed can transition to checked-in'
);

SELECT ok(
  public.is_valid_attendance_transition(
    'checked_in',
    'attended'
  ),
  'Checked-in can transition to attended'
);

SELECT ok(
  public.is_valid_attendance_transition(
    'confirmed',
    'cancelled'
  ),
  'Confirmed can transition to cancelled'
);

SELECT ok(
  public.is_valid_attendance_transition(
    'confirmed',
    'invalidated'
  ),
  'Confirmed can transition to invalidated'
);


-- ------------------------------------------------------------
-- Invalid transitions
-- ------------------------------------------------------------

SELECT ok(
  NOT public.is_valid_attendance_transition(
    'rsvp',
    'checked_in'
  ),
  'RSVP cannot skip confirmed and become checked-in'
);

SELECT ok(
  NOT public.is_valid_attendance_transition(
    'rsvp',
    'attended'
  ),
  'RSVP cannot become attended directly'
);

SELECT ok(
  NOT public.is_valid_attendance_transition(
    'confirmed',
    'attended'
  ),
  'Confirmed cannot skip check-in'
);

SELECT ok(
  NOT public.is_valid_attendance_transition(
    'attended',
    'checked_in'
  ),
  'Attended cannot move backwards'
);


-- ------------------------------------------------------------
-- Schema constraints
-- ------------------------------------------------------------

SELECT has_column(
  'public',
  'event_rsvps',
  'attendance_state',
  'event_rsvps must contain attendance_state'
);

SELECT has_table(
  'public',
  'event_attendance_state_history',
  'Attendance transition history table must exist'
);

SELECT has_function(
  'public',
  'transition_event_attendance',
  ARRAY['uuid', 'text', 'text'],
  'Central attendance transition function must exist'
);


SELECT * FROM finish();

ROLLBACK;