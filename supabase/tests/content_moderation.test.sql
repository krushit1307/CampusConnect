-- supabase/tests/content_moderation.test.sql
-- pgTAP test for content moderation functionality (Issue #5359)
--
-- Run with: psql -f supabase/tests/content_moderation.test.sql

\set ECHO none
BEGIN;
SELECT plan(8);

-- ── Setup: create test data ─────────────────────────────────────────────
INSERT INTO public.profiles (id, email, first_name, last_name)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@test.local', 'Admin', 'User'),
    ('22222222-2222-2222-2222-222222222222', 'user@test.local', 'Test', 'User')
ON CONFLICT (id) DO NOTHING;

-- ── Test 1: Create moderation queue entry ───────────────────────────────
SELECT is(
    (SELECT public.create_moderation_queue_entry(
        '22222222-2222-2222-2222-222222222222',
        'upload-123',
        'test.jpg',
        1024000,
        'image/jpeg',
        'event-gallery',
        'test/path/test.jpg',
        '192.168.1.1',
        'Mozilla/5.0'
    ) IS NOT NULL),
    true,
    'Moderation queue entry should be created successfully'
);

-- ── Test 2: Verify queue entry was created with correct data ───────────────
SELECT is(
    (SELECT file_name FROM public.content_moderation_queue WHERE upload_id = 'upload-123'),
    'test.jpg',
    'File name should be correct'
);

SELECT is(
    (SELECT screening_status FROM public.content_moderation_queue WHERE upload_id = 'upload-123'),
    'pending',
    'Screening status should be pending'
);

-- ── Test 3: Store content hash ───────────────────────────────────────────
DO $$
DECLARE
    v_queue_id UUID;
BEGIN
    SELECT id INTO v_queue_id
    FROM public.content_moderation_queue
    WHERE upload_id = 'upload-123'
    LIMIT 1;
    
    PERFORM public.store_content_hash(v_queue_id, 'md5', '5d41402abc4b2a76b9719d911017c592');
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.content_hashes WHERE moderation_queue_id = (SELECT id FROM public.content_moderation_queue WHERE upload_id = 'upload-123')),
    1,
    'Content hash should be stored'
);

-- ── Test 4: Reject content ─────────────────────────────────────────────
DO $$
DECLARE
    v_queue_id UUID;
BEGIN
    SELECT id INTO v_queue_id
    FROM public.content_moderation_queue
    WHERE upload_id = 'upload-123'
    LIMIT 1;
    
    PERFORM public.reject_content(v_queue_id, 'CSAM match detected', 'NCMEC', 95.5);
END $$;

SELECT is(
    (SELECT screening_status FROM public.content_moderation_queue WHERE upload_id = 'upload-123'),
    'rejected',
    'Screening status should be rejected'
);

SELECT is(
    (SELECT is_hash_match FROM public.content_moderation_queue WHERE upload_id = 'upload-123'),
    true,
    'Hash match should be true'
);

-- ── Test 5: Verify forensic report was created for CSAM ───────────────────
SELECT is(
    (SELECT COUNT(*) FROM public.forensic_reports WHERE moderation_queue_id = (SELECT id FROM public.content_moderation_queue WHERE upload_id = 'upload-123')),
    1,
    'Forensic report should be created for CSAM match'
);

SELECT is(
    (SELECT report_type FROM public.forensic_reports WHERE moderation_queue_id = (SELECT id FROM public.content_moderation_queue WHERE upload_id = 'upload-123')),
    'csam',
    'Report type should be csam'
);

-- ── Test 6: Suspend user ───────────────────────────────────────────────
DO $$
DECLARE
    v_suspension_id UUID;
BEGIN
    SELECT public.suspend_user(
        '22222222-2222-2222-2222-222222222222',
        'csam',
        'CSAM content upload',
        'critical',
        true,
        NULL,
        NULL
    ) INTO v_suspension_id;
END $$;

SELECT is(
    (SELECT COUNT(*) FROM public.user_suspensions WHERE user_id = '22222222-2222-2222-2222-222222222222'),
    1,
    'User should be suspended'
);

SELECT is(
    (SELECT is_permanent FROM public.user_suspensions WHERE user_id = '22222222-2222-2222-2222-222222222222'),
    true,
    'Suspension should be permanent'
);

-- ── Test 7: Check if user is suspended ───────────────────────────────────
SELECT is(
    (SELECT public.is_user_suspended('22222222-2222-2222-2222-222222222222')),
    true,
    'User should be flagged as suspended'
);

-- ── Test 8: Approve content (different queue entry) ───────────────────────
DO $$
DECLARE
    v_queue_id UUID;
BEGIN
    SELECT public.create_moderation_queue_entry(
        '22222222-2222-2222-2222-222222222222',
        'upload-456',
        'clean.jpg',
        1024000,
        'image/jpeg',
        'event-gallery',
        'test/path/clean.jpg',
        NULL,
        NULL
    ) INTO v_queue_id;
    
    PERFORM public.approve_content(v_queue_id);
END $$;

SELECT is(
    (SELECT screening_status FROM public.content_moderation_queue WHERE upload_id = 'upload-456'),
    'approved',
    'Screening status should be approved'
);

-- ── Cleanup ───────────────────────────────────────────────────────────
DELETE FROM public.forensic_reports WHERE moderation_queue_id IN (SELECT id FROM public.content_moderation_queue WHERE upload_id IN ('upload-123', 'upload-456'));
DELETE FROM public.content_hashes WHERE moderation_queue_id IN (SELECT id FROM public.content_moderation_queue WHERE upload_id IN ('upload-123', 'upload-456'));
DELETE FROM public.content_moderation_queue WHERE upload_id IN ('upload-123', 'upload-456');
DELETE FROM public.user_suspensions WHERE user_id = '22222222-2222-2222-2222-222222222222';
DELETE FROM public.profiles WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT * FROM finish();
ROLLBACK;
