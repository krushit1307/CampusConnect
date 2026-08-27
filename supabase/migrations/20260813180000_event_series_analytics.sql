ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS series_id UUID;

CREATE INDEX IF NOT EXISTS idx_events_series_id
ON public.events(series_id);

COMMENT ON COLUMN public.events.series_id IS
'Groups recurring event instances into an Event Series for analytics rollups.';


-- ============================================================
-- Event Series Analytics RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_event_series_analytics(
  p_series_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id UUID;
  v_is_authorized BOOLEAN;
  v_event_count INTEGER;
  v_total_unique_attendees INTEGER;
  v_core_cohort INTEGER;
  v_one_time_dropins INTEGER;
  v_events JSON;
  v_retention JSON;
  v_super_fans JSON;
  v_churn_reasons JSON; -- NEW: Added variable for churn analytics
BEGIN

  -- ----------------------------------------------------------
  -- Find the club that owns this series.
  -- ----------------------------------------------------------
  SELECT e.club_id
  INTO v_club_id
  FROM public.events e
  WHERE e.series_id = p_series_id
  ORDER BY e.event_date NULLS LAST
  LIMIT 1;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Event series not found';
  END IF;


  -- ----------------------------------------------------------
  -- Authorization
  -- ----------------------------------------------------------
  SELECT EXISTS (
    SELECT 1
    FROM public.clubs c
    WHERE c.id = v_club_id
      AND c.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = v_club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'owner')
      AND cm.status = 'approved'
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'system_admin'
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to view this event series';
  END IF;


  -- ----------------------------------------------------------
  -- Only non-cancelled events are considered actual series
  -- instances.
  -- ----------------------------------------------------------
  WITH series_events AS (
    SELECT
      e.id,
      e.title,
      e.event_date,
      ROW_NUMBER() OVER (
        ORDER BY e.event_date NULLS LAST, e.created_at, e.id
      ) AS week_number
    FROM public.events e
    WHERE e.series_id = p_series_id
      AND LOWER(COALESCE(e.status, '')) NOT IN (
        'cancelled',
        'canceled'
      )
  )
  SELECT COUNT(*)
  INTO v_event_count
  FROM series_events;


  -- ----------------------------------------------------------
  -- Total unique attendees across the complete series.
  -- ----------------------------------------------------------
  SELECT COUNT(DISTINCT r.user_id)
  INTO v_total_unique_attendees
  FROM public.event_rsvps r
  JOIN public.events e
    ON e.id = r.event_id
  WHERE e.series_id = p_series_id
    AND LOWER(COALESCE(e.status, '')) NOT IN (
      'cancelled',
      'canceled'
    )
    AND r.checked_in = TRUE;


  -- ----------------------------------------------------------
  -- Core cohort
  -- ----------------------------------------------------------
  WITH series_events AS (
    SELECT e.id
    FROM public.events e
    WHERE e.series_id = p_series_id
      AND LOWER(COALESCE(e.status, '')) NOT IN (
        'cancelled',
        'canceled'
      )
  ),
  attendee_counts AS (
    SELECT
      r.user_id,
      COUNT(DISTINCT r.event_id) AS attended_events
    FROM public.event_rsvps r
    JOIN series_events se
      ON se.id = r.event_id
    WHERE r.checked_in = TRUE
    GROUP BY r.user_id
  )
  SELECT COUNT(*)
  INTO v_core_cohort
  FROM attendee_counts
  WHERE attended_events = v_event_count;


  -- ----------------------------------------------------------
  -- One-time drop-ins
  -- ----------------------------------------------------------
  WITH series_events AS (
    SELECT e.id
    FROM public.events e
    WHERE e.series_id = p_series_id
      AND LOWER(COALESCE(e.status, '')) NOT IN (
        'cancelled',
        'canceled'
      )
  ),
  attendee_counts AS (
    SELECT
      r.user_id,
      COUNT(DISTINCT r.event_id) AS attended_events
    FROM public.event_rsvps r
    JOIN series_events se
      ON se.id = r.event_id
    WHERE r.checked_in = TRUE
    GROUP BY r.user_id
  )
  SELECT COUNT(*)
  INTO v_one_time_dropins
  FROM attendee_counts
  WHERE attended_events = 1;


  -- ----------------------------------------------------------
  -- Event-level summary
  -- ----------------------------------------------------------
  WITH series_events AS (
    SELECT
      e.id,
      e.title,
      e.event_date,
      ROW_NUMBER() OVER (
        ORDER BY e.event_date NULLS LAST, e.created_at, e.id
      ) AS week_number
    FROM public.events e
    WHERE e.series_id = p_series_id
      AND LOWER(COALESCE(e.status, '')) NOT IN (
        'cancelled',
        'canceled'
      )
  ),
  attendance AS (
    SELECT
      se.id,
      COUNT(DISTINCT r.user_id) FILTER (
        WHERE r.checked_in = TRUE
      ) AS attendees
    FROM series_events se
    LEFT JOIN public.event_rsvps r
      ON r.event_id = se.id
    GROUP BY se.id
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'week', se.week_number,
        'event_id', se.id,
        'title', se.title,
        'event_date', se.event_date,
        'attendees', COALESCE(a.attendees, 0)
      )
      ORDER BY se.week_number
    ),
    '[]'::json
  )
  INTO v_events
  FROM series_events se
  LEFT JOIN attendance a
    ON a.id = se.id;


  -- ----------------------------------------------------------
  -- Retention
  -- ----------------------------------------------------------
  WITH series_events AS (
    SELECT
      e.id,
      ROW_NUMBER() OVER (
        ORDER BY e.event_date NULLS LAST, e.created_at, e.id
      ) AS week_number
    FROM public.events e
    WHERE e.series_id = p_series_id
      AND LOWER(COALESCE(e.status, '')) NOT IN (
        'cancelled',
        'canceled'
      )
  ),
  week_one_users AS (
    SELECT DISTINCT r.user_id
    FROM public.event_rsvps r
    JOIN series_events se
      ON se.id = r.event_id
    WHERE se.week_number = 1
      AND r.checked_in = TRUE
  ),
  week_attendance AS (
    SELECT
      se.week_number,
      COUNT(DISTINCT r.user_id) FILTER (
        WHERE r.checked_in = TRUE
      ) AS attendees,
      COUNT(DISTINCT r.user_id) FILTER (
        WHERE r.checked_in = TRUE
        AND r.user_id IN (
          SELECT user_id FROM week_one_users
        )
      ) AS retained_users
    FROM series_events se
    LEFT JOIN public.event_rsvps r
      ON r.event_id = se.id
    GROUP BY se.week_number
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'week', week_number,
        'attendees', attendees,
        'retained_users', retained_users,
        'retention_rate',
          CASE
            WHEN (SELECT COUNT(*) FROM week_one_users) = 0
              THEN 0
            ELSE ROUND(
              (
                retained_users::NUMERIC
                / (SELECT COUNT(*) FROM week_one_users)
              ) * 100,
              2
            )
          END
      )
      ORDER BY week_number
    ),
    '[]'::json
  )
  INTO v_retention
  FROM week_attendance;


  -- ----------------------------------------------------------
  -- Super Fans
  -- ----------------------------------------------------------
  WITH series_events AS (
    SELECT e.id
    FROM public.events e
    WHERE e.series_id = p_series_id
      AND LOWER(COALESCE(e.status, '')) NOT IN (
        'cancelled',
        'canceled'
      )
  ),
  super_fans AS (
    SELECT
      r.user_id,
      COUNT(DISTINCT r.event_id) AS attended_events
    FROM public.event_rsvps r
    JOIN series_events se
      ON se.id = r.event_id
    WHERE r.checked_in = TRUE
    GROUP BY r.user_id
    HAVING COUNT(DISTINCT r.event_id) = (
      SELECT COUNT(*) FROM series_events
    )
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'user_id', sf.user_id,
        'attended_events', sf.attended_events
      )
      ORDER BY sf.user_id
    ),
    '[]'::json
  )
  INTO v_super_fans
  FROM super_fans sf;

  -- ----------------------------------------------------------
  -- NEW: Churn Reasons Aggregation
  -- ----------------------------------------------------------
  WITH series_events AS (
    SELECT e.id
    FROM public.events e
    WHERE e.series_id = p_series_id
      AND LOWER(COALESCE(e.status, '')) NOT IN (
        'cancelled',
        'canceled'
      )
  ),
  churn_stats AS (
    SELECT
      ef.churn_reason AS reason,
      COUNT(*) AS count
    FROM public.event_feedback ef
    JOIN series_events se ON se.id = ef.event_id
    WHERE ef.churn_reason IS NOT NULL
    GROUP BY ef.churn_reason
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'reason', cs.reason,
        'count', cs.count
      )
      ORDER BY cs.count DESC
    ),
    '[]'::json
  )
  INTO v_churn_reasons
  FROM churn_stats cs;


  RETURN json_build_object(
    'series_id', p_series_id,
    'event_count', v_event_count,
    'total_unique_attendees', COALESCE(v_total_unique_attendees, 0),
    'core_cohort', COALESCE(v_core_cohort, 0),
    'one_time_dropins', COALESCE(v_one_time_dropins, 0),
    'events', COALESCE(v_events, '[]'::json),
    'retention', COALESCE(v_retention, '[]'::json),
    'super_fans', COALESCE(v_super_fans, '[]'::json),
    'churn_reasons', COALESCE(v_churn_reasons, '[]'::json) -- NEW: Return the churn reasons array
  );
END;
$$;

GRANT EXECUTE
ON FUNCTION public.get_event_series_analytics(UUID)
TO authenticated;
