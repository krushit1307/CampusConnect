-- supabase/tests/speaker_briefing.test.sql
-- pgTAP test for speaker briefing functionality (Issue #5059)
--
-- Run with: psql -f supabase/tests/speaker_briefing.test.sql

\set ECHO none
BEGIN;
SELECT plan(8);

-- ── Setup: create test club, event, and user ─────────────────────────────
INSERT INTO public.profiles (id, email, first_name, last_name)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'speaker@test.local', 'John', 'Speaker')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Club', 'test-club', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, start_date, speaker_email, speaker_name)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Speaker Test Event',
    NOW() + INTERVAL '72 hours',
    'speaker@test.local',
    'John Speaker'
)
ON CONFLICT (id) DO NOTHING;

-- ── Test 1: Create speaker briefing ───────────────────────────────────────
SELECT is(
    (SELECT public.create_speaker_briefing('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 30) IS NOT NULL),
    true,
    'Speaker briefing should be created successfully'
);

-- ── Test 2: Check briefing was created with correct status ───────────────
SELECT is(
    (SELECT status FROM public.speaker_briefings WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'pending',
    'Briefing should have pending status'
);

-- ── Test 3: Aggregate student discussions ────────────────────────────────
SELECT is(
    (SELECT COUNT(*) FROM public.aggregate_student_discussions('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 30)),
    1,
    'Should return aggregated discussion data'
);

-- ── Test 4: Update briefing content ───────────────────────────────────────
DO $$
DECLARE
    v_briefing_id UUID;
BEGIN
    SELECT id INTO v_briefing_id
    FROM public.speaker_briefings
    WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    LIMIT 1;
    
    IF v_briefing_id IS NOT NULL THEN
        PERFORM public.update_briefing_content(
            v_briefing_id,
            'Test summary',
            '[{"topic": "Test", "description": "Test", "severity": "high"}]'::JSONB,
            '[{"topic": "Test", "description": "Test", "relevance": "high"}]'::JSONB,
            '[{"question": "Test", "context": "Test", "priority": "high"}]'::JSONB
        );
    END IF;
END $$;

SELECT is(
    (SELECT briefing_summary FROM public.speaker_briefings WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'Test summary',
    'Briefing summary should be updated'
);

-- ── Test 5: Complete briefing with PDF URL ───────────────────────────────
DO $$
DECLARE
    v_briefing_id UUID;
BEGIN
    SELECT id INTO v_briefing_id
    FROM public.speaker_briefings
    WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    LIMIT 1;
    
    IF v_briefing_id IS NOT NULL THEN
        PERFORM public.complete_briefing(v_briefing_id, 'https://example.com/briefing.pdf');
    END IF;
END $$;

SELECT is(
    (SELECT status FROM public.speaker_briefings WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'completed',
    'Briefing should be marked as completed'
);

SELECT is(
    (SELECT pdf_url FROM public.speaker_briefings WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'https://example.com/briefing.pdf',
    'PDF URL should be recorded'
);

-- ── Test 6: Fail briefing ────────────────────────────────────────────────
INSERT INTO public.speaker_briefings (event_id, club_id, aggregation_start_date, aggregation_end_date, status)
VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    NOW() - INTERVAL '30 days',
    NOW(),
    'pending'
);

DO $$
BEGIN
    PERFORM public.fail_briefing('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Test error');
END $$;

SELECT is(
    (SELECT status FROM public.speaker_briefings WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    'failed',
    'Briefing should be marked as failed'
);

SELECT is(
    (SELECT error_message FROM public.speaker_briefings WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    'Test error',
    'Error message should be recorded'
);

-- ── Test 7: Get events needing briefings ───────────────────────────────────
SELECT is(
    (SELECT COUNT(*) FROM public.get_events_needing_briefings()),
    1,
    'Should return events needing briefings'
);

-- ── Test 8: Briefing should not be created twice within 24 hours ───────────
DO $$
BEGIN
    -- Try to create another briefing for the same event
    PERFORM public.create_speaker_briefing('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 30);
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.speaker_briefings WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    1,
    'Should not create duplicate briefing within 24 hours'
);

-- ── Cleanup ───────────────────────────────────────────────────────────
DELETE FROM public.speaker_briefings WHERE event_id IN ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
DELETE FROM public.events WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.clubs WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DELETE FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT * FROM finish();
ROLLBACK;
