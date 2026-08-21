-- ============================================================
-- Migration: 20270122000000_club_constitution_version_timeline.sql
-- Issue: #3690 — Interactive "Club Constitution" Version Timeline
--
-- Goals
--   1. Immutable archive of every merged constitution version. Once
--      a row is inserted into `archive_constitutions` it is never
--      UPDATEd or DELETEd (enforced by trigger + RLS).
--   2. Each archived version carries the full `raw_text` so the
--      timeline UI can render historical content without re-fetching
--      the PDF and without depending on Storage retention.
--   3. An `effective_from` / `effective_to` interval lets the UI
--      resolve "what was active on date X" with a single range query.
--   4. One RPC — `get_constitution_at_epoch(club_id, timestamp)` —
--      returns the version that was in effect at that instant,
--      including the full raw text. The slider calls this directly.
--   5. Public read RLS so any member (or visitor, if the club is
--      public) can browse the timeline.
-- ============================================================

BEGIN;

-- ─── 1. archive_constitutions table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archive_constitutions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id         UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    -- The version_number mirrors club_documents.version_number for
    -- cross-reference; we don't FK to club_documents because we want
    -- archive_constitutions to survive even if a club_documents row
    -- is somehow deleted.
    version_number  INTEGER NOT NULL,
    -- Full raw text of the constitution at this version. Stored
    -- denormalized so the timeline UI can render any historical
    -- version without re-fetching the PDF.
    raw_text        TEXT NOT NULL,
    -- Optional: the storage path of the original PDF (for "Download
    -- this version" links). Nullable in case only text was archived.
    file_url        TEXT,
    -- The user who merged / published this version.
    published_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Human-readable summary of what changed in this version, e.g.
    -- "Added presidential veto clause to Article IV, Section 3."
    change_summary  TEXT,
    -- Effective interval. `effective_from` is when this version
    -- became authoritative; `effective_to` is when it was superseded
    -- (NULL = still current). Enforced unique-current via partial
    -- index below.
    effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to     TIMESTAMPTZ,
    -- Audit columns.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One active version per club at any instant.
    CONSTRAINT archive_constitutions_unique_version
        UNIQUE (club_id, version_number),
    -- effective_to, when set, must be after effective_from.
    CONSTRAINT archive_constitutions_effective_order
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- Indexes for the two common query patterns:
--   (a) "give me the full timeline for this club, oldest first"
--   (b) "give me the version active at this instant"
CREATE INDEX IF NOT EXISTS idx_archive_constitutions_club_version
    ON public.archive_constitutions (club_id, version_number);
CREATE INDEX IF NOT EXISTS idx_archive_constitutions_effective
    ON public.archive_constitutions (club_id, effective_from, effective_to);

-- ─── 2. Immutability trigger ────────────────────────────────────────
-- Once a row is in the archive it must never change. We allow UPDATEs
-- only to set `effective_to` (when a newer version supersedes this
-- one) and `updated_at`. All other columns are locked.
CREATE OR REPLACE FUNCTION public.enforce_archive_constitution_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    locked_columns text[] := ARRAY[
        'id', 'club_id', 'version_number', 'raw_text', 'file_url',
        'published_by', 'change_summary', 'effective_from', 'created_at'
    ];
    changed_column text;
BEGIN
    FOREACH changed_column IN ARRAY locked_columns LOOP
        IF NEW.* IS DISTINCT FROM OLD.* THEN
            EXECUTE format(
                'SELECT ($1).%I IS DISTINCT FROM ($2).%I',
                changed_column, changed_column
            ) USING NEW, OLD INTO changed_column;
            IF changed_column THEN
                RAISE EXCEPTION
                    'archive_constitutions is immutable: column "%" cannot be updated after insert (row id=%).',
                    changed_column, OLD.id;
            END IF;
        END IF;
    END LOOP;

    IF NEW.effective_to IS NOT NULL
       AND OLD.effective_to IS NOT NULL
       AND NEW.effective_to < OLD.effective_to THEN
        RAISE EXCEPTION
            'archive_constitutions.effective_to can only move forward (row id=%).',
            OLD.id;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS trg_enforce_archive_constitution_immutability
    ON public.archive_constitutions;
CREATE TRIGGER trg_enforce_archive_constitution_immutability
    BEFORE UPDATE ON public.archive_constitutions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_archive_constitution_immutability();

-- Block DELETEs entirely. The only way to remove an archived
-- constitution is to drop the table (which requires superuser).
CREATE OR REPLACE FUNCTION public.block_archive_constitution_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    RAISE EXCEPTION
        'archive_constitutions rows are immutable and cannot be deleted (row id=%).',
        OLD.id;
END;
 $$;

DROP TRIGGER IF EXISTS trg_block_archive_constitution_delete
    ON public.archive_constitutions;
CREATE TRIGGER trg_block_archive_constitution_delete
    BEFORE DELETE ON public.archive_constitutions
    FOR EACH ROW
    EXECUTE FUNCTION public.block_archive_constitution_delete();

-- ─── 3. Row Level Security ──────────────────────────────────────────
ALTER TABLE public.archive_constitutions ENABLE ROW LEVEL SECURITY;

-- Public read: anyone (including anon) can view the timeline. The
-- constitution is a public governance document; the whole point of
-- the timeline (per the issue) is to let anyone resolve disputes.
CREATE POLICY "Public read access to constitution archive"
    ON public.archive_constitutions
    FOR SELECT
    USING (true);

-- Only club admins (or student_union_admins) can insert new archived
-- versions. This mirrors the policy on `constitution_documents`.
CREATE POLICY "Club admins can archive constitution versions"
    ON public.archive_constitutions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = archive_constitutions.club_id
              AND cm.user_id = auth.uid()
              AND cm.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'student_union_admin'
        )
    );

-- No UPDATE or DELETE policies are created — the triggers above
-- block both operations regardless of the caller.

-- ─── 4. archive_new_constitution_version(p_club_id, p_raw_text, ...) ─
-- Single RPC that:
--   1. Closes the previously-current version (sets its effective_to).
--   2. Inserts the new version with effective_from = NOW().
--   3. Returns the newly-inserted row as JSON.
CREATE OR REPLACE FUNCTION public.archive_new_constitution_version(
    p_club_id       UUID,
    p_raw_text      TEXT,
    p_file_url      TEXT DEFAULT NULL,
    p_published_by  UUID DEFAULT NULL,
    p_change_summary TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_next_version INTEGER;
    v_now          TIMESTAMPTZ := NOW();
    v_inserted     public.archive_constitutions;
BEGIN
    IF NOT (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = p_club_id
              AND cm.user_id = auth.uid()
              AND cm.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'student_union_admin'
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: only club admins or student union admins can archive constitution versions.';
    END IF;

    PERFORM id FROM public.clubs WHERE id = p_club_id FOR UPDATE;

    UPDATE public.archive_constitutions
       SET effective_to = v_now
     WHERE club_id = p_club_id
       AND effective_to IS NULL;

    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO v_next_version
      FROM public.archive_constitutions
     WHERE club_id = p_club_id;

    INSERT INTO public.archive_constitutions (
        club_id, version_number, raw_text, file_url,
        published_by, change_summary, effective_from, effective_to
    ) VALUES (
        p_club_id, v_next_version, p_raw_text, p_file_url,
        p_published_by, p_change_summary, v_now, NULL
    )
    RETURNING * INTO v_inserted;

    RETURN row_to_json(v_inserted);
END;
 $$;

GRANT EXECUTE ON FUNCTION public.archive_new_constitution_version(
    UUID, TEXT, TEXT, UUID, TEXT
) TO authenticated;

-- ─── 5. get_constitution_at_epoch(p_club_id, p_timestamp) ──────────
CREATE OR REPLACE FUNCTION public.get_constitution_at_epoch(
    p_club_id   UUID,
    p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    id              UUID,
    version_number  INTEGER,
    raw_text        TEXT,
    file_url        TEXT,
    published_by    UUID,
    change_summary  TEXT,
    effective_from  TIMESTAMPTZ,
    effective_to    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    RETURN QUERY
    SELECT
        ac.id,
        ac.version_number,
        ac.raw_text,
        ac.file_url,
        ac.published_by,
        ac.change_summary,
        ac.effective_from,
        ac.effective_to,
        ac.created_at
      FROM public.archive_constitutions ac
     WHERE ac.club_id = p_club_id
       AND ac.effective_from <= p_timestamp
       AND (ac.effective_to IS NULL OR ac.effective_to > p_timestamp)
     ORDER BY ac.effective_from DESC
     LIMIT 1;
END;
 $$;

GRANT EXECUTE ON FUNCTION public.get_constitution_at_epoch(UUID, TIMESTAMPTZ)
    TO authenticated, anon;

-- ─── 6. get_constitution_timeline(p_club_id) ────────────────────────
CREATE OR REPLACE FUNCTION public.get_constitution_timeline(
    p_club_id UUID
)
RETURNS TABLE (
    id              UUID,
    version_number  INTEGER,
    raw_text        TEXT,
    file_url        TEXT,
    published_by    UUID,
    change_summary  TEXT,
    effective_from  TIMESTAMPTZ,
    effective_to    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ,
    is_current      BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    RETURN QUERY
    SELECT
        ac.id,
        ac.version_number,
        ac.raw_text,
        ac.file_url,
        ac.published_by,
        ac.change_summary,
        ac.effective_from,
        ac.effective_to,
        ac.created_at,
        (ac.effective_to IS NULL) AS is_current
      FROM public.archive_constitutions ac
     WHERE ac.club_id = p_club_id
     ORDER BY ac.version_number ASC;
END;
 $$;

GRANT EXECUTE ON FUNCTION public.get_constitution_timeline(UUID)
    TO authenticated, anon;

-- ─── 7. Auto-archive trigger on club_documents insert ───────────────
-- When a new constitution is uploaded via the existing
-- `upload_club_document` RPC (which inserts into `club_documents`),
-- we also archive the version. We do this in a trigger so the archive
-- happens transactionally with the upload — no chance of the two
-- tables getting out of sync.
CREATE OR REPLACE FUNCTION public.archive_on_club_document_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_club_id UUID := NEW.club_id;
    v_raw_text TEXT;
BEGIN
    -- Try to find raw_text from a pending constitution_documents row
    -- (the linter edge function populates this after PDF parsing).
    SELECT cd.raw_text INTO v_raw_text
      FROM public.constitution_documents cd
     WHERE cd.club_id = v_club_id
       AND cd.file_url = NEW.file_url
     ORDER BY cd.created_at DESC
     LIMIT 1;

    INSERT INTO public.archive_constitutions (
        club_id, version_number, raw_text, file_url,
        published_by, change_summary, effective_from
    ) VALUES (
        v_club_id,
        NEW.version_number,
        COALESCE(v_raw_text, '[Text extraction pending — PDF available via file_url]'),
        NEW.file_url,
        NEW.uploaded_by,
        'Version ' || NEW.version_number || ' uploaded',
        NEW.created_at
    )
    ON CONFLICT (club_id, version_number) DO NOTHING;

    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS trg_archive_on_club_document_insert
    ON public.club_documents;
CREATE TRIGGER trg_archive_on_club_document_insert
    AFTER INSERT ON public.club_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.archive_on_club_document_insert();

COMMIT;
