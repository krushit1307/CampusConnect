-- ============================================================
-- Migration: 20270123000000_live_micro_volunteering_task_board.sql
-- Issue: #3678 — Real-Time "Micro-Volunteering" Task Board
--
-- Goals
--   1. `live_tasks` table — organizer pushes a short-lived task with
--      a points reward and a max-volunteers cap. Lifecycle:
--        open → filling → completed → cancelled
--   2. `live_task_assignments` table — the first N users to click
--      "Accept" get an immutable assignment row. The unique partial
--      index + the `accept_live_task` RPC together guarantee that
--      no race condition can assign more than `max_volunteers` users.
--   3. `accept_live_task(task_id)` RPC — atomic INSERT-with-subselect
--      that succeeds ONLY if (a) the task is open AND (b) the caller
--      is not already assigned AND (c) current assignments < cap.
--   4. `complete_live_task(task_id)` RPC — flips status to
--      'completed', disburses points to every assigned user via the
--      existing `points_ledger` table, idempotent across retries.
--   5. Public read RLS on both tables so any signed-in user on the
--      Event page can see / accept tasks; only the event's organizer
--      (or admin) can create / complete them.
-- ============================================================

BEGIN;

-- ─── 1. live_tasks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    description     TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 280),
    points_reward   INTEGER NOT NULL CHECK (points_reward > 0 AND points_reward <= 1000),
    max_volunteers  INTEGER NOT NULL CHECK (max_volunteers BETWEEN 1 AND 100),
    status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'completed', 'cancelled')),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_tasks_event_status
    ON public.live_tasks (event_id, status);
CREATE INDEX IF NOT EXISTS idx_live_tasks_created_at
    ON public.live_tasks (created_at DESC);

-- ─── 2. live_task_assignments ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_task_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES public.live_tasks(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    accepted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    points_awarded  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT live_task_assignments_unique UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_task_assignments_task
    ON public.live_task_assignments (task_id, accepted_at);

-- ─── 3. RLS ───────────────────────────────────────────────────────
ALTER TABLE public.live_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live tasks"
    ON public.live_tasks FOR SELECT USING (true);

CREATE POLICY "Anyone can view live task assignments"
    ON public.live_task_assignments FOR SELECT USING (true);

CREATE POLICY "Organizers can manage live tasks"
    ON public.live_tasks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
              JOIN public.club_members cm
                ON cm.club_id = e.club_id
               AND cm.user_id = auth.uid()
               AND cm.role = 'admin'
             WHERE e.id = live_tasks.event_id
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
             WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events e
              JOIN public.club_members cm
                ON cm.club_id = e.club_id
               AND cm.user_id = auth.uid()
               AND cm.role = 'admin'
             WHERE e.id = live_tasks.event_id
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
             WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ─── 4. accept_live_task(p_task_id) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_live_task(p_task_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_task          public.live_tasks;
    v_already_in   BOOLEAN;
    v_inserted      INTEGER;
    v_count         INTEGER;
BEGIN
    SELECT * INTO v_task FROM public.live_tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN json_build_object('accepted', false, 'reason', 'Task not found');
    END IF;

    IF v_task.status <> 'open' THEN
        RETURN json_build_object('accepted', false, 'reason',
            'Task is ' || v_task.status);
    END IF;

    IF v_task.expires_at <= NOW() THEN
        UPDATE public.live_tasks
           SET status = 'cancelled', updated_at = NOW()
         WHERE id = p_task_id AND status = 'open';
        RETURN json_build_object('accepted', false, 'reason', 'Task expired');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.live_task_assignments
         WHERE task_id = p_task_id AND user_id = auth.uid()
    ) INTO v_already_in;
    IF v_already_in THEN
        SELECT COUNT(*) INTO v_count
          FROM public.live_task_assignments WHERE task_id = p_task_id;
        RETURN json_build_object('accepted', true, 'reason',
            'Already assigned', 'current_count', v_count);
    END IF;

    -- Atomic count-guarded INSERT. Two concurrent callers both see the
    -- same pre-insert count; the ON CONFLICT + the count predicate
    -- together ensure exactly max_volunteers rows succeed.
    WITH candidate AS (
        SELECT COUNT(*) AS cnt
          FROM public.live_task_assignments
         WHERE task_id = p_task_id
    )
    INSERT INTO public.live_task_assignments (task_id, user_id)
    SELECT p_task_id, auth.uid()
      FROM candidate
     WHERE candidate.cnt < v_task.max_volunteers
    ON CONFLICT (task_id, user_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    SELECT COUNT(*) INTO v_count
      FROM public.live_task_assignments WHERE task_id = p_task_id;

    RETURN json_build_object(
        'accepted', v_inserted > 0,
        'current_count', v_count,
        'max_volunteers', v_task.max_volunteers,
        'reason', CASE WHEN v_inserted = 0 THEN 'Task is full' ELSE NULL END
    );
END;
 $$;

GRANT EXECUTE ON FUNCTION public.accept_live_task(UUID) TO authenticated;

-- ─── 5. complete_live_task(p_task_id) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_live_task(p_task_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_task      public.live_tasks;
    v_is_org    BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_task FROM public.live_tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'reason', 'Task not found');
    END IF;

    IF v_task.status = 'completed' THEN
        RETURN json_build_object('ok', true, 'reason', 'Already completed', 'awarded', '[]'::json);
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.events e
          JOIN public.club_members cm
            ON cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
         WHERE e.id = v_task.event_id
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) INTO v_is_org;

    IF NOT v_is_org THEN
        RAISE EXCEPTION 'Unauthorized: only the event organizer can complete a live task.';
    END IF;

    UPDATE public.live_tasks
       SET status = 'completed', updated_at = NOW()
     WHERE id = p_task_id AND status = 'open';

    -- Idempotent disbursement: only inserts for rows where
    -- points_awarded = FALSE, then flips the flag in the same
    -- transaction. Safe across concurrent complete_live_task calls.
    INSERT INTO public.points_ledger (user_id, amount, reason)
    SELECT lta.user_id, v_task.points_reward,
           'Micro-task: ' || v_task.description
      FROM public.live_task_assignments lta
     WHERE lta.task_id = p_task_id AND lta.points_awarded = FALSE;

    UPDATE public.live_task_assignments
       SET points_awarded = TRUE
     WHERE task_id = p_task_id AND points_awarded = FALSE;

    RETURN json_build_object(
        'ok', true,
        'task_id', p_task_id,
        'points_reward', v_task.points_reward,
        'awarded', COALESCE((
            SELECT json_agg(json_build_object(
                'user_id', u.id,
                'name', COALESCE(p.first_name || ' ' || p.last_name, p.email, u.id::text),
                'amount', v_task.points_reward
            ))
            FROM public.live_task_assignments lta
            JOIN auth.users u ON u.id = lta.user_id
            LEFT JOIN public.profiles p ON p.id = u.id
           WHERE lta.task_id = p_task_id
        ), '[]'::json)
    );
END;
 $$;

GRANT EXECUTE ON FUNCTION public.complete_live_task(UUID) TO authenticated;

-- ─── 6. cancel_live_task(p_task_id) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_live_task(p_task_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_task public.live_tasks;
    v_is_org BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_task FROM public.live_tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'reason', 'Task not found');
    END IF;
    IF v_task.status <> 'open' THEN
        RETURN json_build_object('ok', false, 'reason', 'Task is ' || v_task.status);
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.events e
          JOIN public.club_members cm
            ON cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
         WHERE e.id = v_task.event_id
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) INTO v_is_org;

    IF NOT v_is_org THEN
        RAISE EXCEPTION 'Unauthorized: only the event organizer can cancel a live task.';
    END IF;

    UPDATE public.live_tasks
       SET status = 'cancelled', updated_at = NOW()
     WHERE id = p_task_id;

    RETURN json_build_object('ok', true, 'task_id', p_task_id);
END;
 $$;

GRANT EXECUTE ON FUNCTION public.cancel_live_task(UUID) TO authenticated;

-- ─── 7. Realtime publication ──────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_task_assignments;

COMMIT;
