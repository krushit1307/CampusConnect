-- ============================================================
-- Migration: 20260824000003_skill_gap_analyzer.sql
-- Description:
--   Executive Board Skill Gap Analyzer. Aggregates verified skills
--   of all admin-role club members and compares them against a
--   "Healthy Board" heuristic matrix. Returns a radar-chart-ready
--   JSON payload with coverage scores and missing-skill warnings.
-- ============================================================

-- 1. The heuristic matrix: defines which skill categories a healthy
--    executive board must cover. Each entry has:
--      category  – display label for the radar axis
--      required  – minimum admins who should have at least one skill
--                  in this category (default 1)
--      keywords  – skill keywords that satisfy this category
--    This is a function (not a table) so it can be tuned without a
--    migration, and it stays version-controlled in source.
CREATE OR REPLACE FUNCTION public.get_skill_gap_analysis(p_club_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  -- "Healthy Board" heuristic matrix
  v_matrix JSONB := '[
    {"category": "Finance",     "required": 1, "keywords": ["finance", "accounting", "budgeting", "bookkeeping", "financial modeling", "tax"]},
    {"category": "Design",      "required": 1, "keywords": ["design", "graphic design", "photoshop", "figma", "ui", "ux", "illustration", "canva", "visual design"]},
    {"category": "Marketing",   "required": 1, "keywords": ["marketing", "social media", "seo", "content", "copywriting", "branding", "advertising", "public relations"]},
    {"category": "Technology",  "required": 1, "keywords": ["programming", "coding", "software", "web development", "python", "javascript", "react", "node", "database", "devops", "engineering"]},
    {"category": "Logistics",   "required": 1, "keywords": ["logistics", "project management", "operations", "planning", "coordination", "event management", "scheduling"]},
    {"category": "Leadership",  "required": 1, "keywords": ["leadership", "management", "mentoring", "public speaking", "negotiation", "conflict resolution", "strategy"]}
  ]::JSONB;

  v_result     JSONB;
  v_admin_ids  UUID[];
  v_all_skills TEXT[];
  v_axes       JSONB := '[]'::JSONB;
  v_warnings   JSONB := '[]'::JSONB;
  v_total_members INT;
  v_skill_diversity NUMERIC;
  entry        JSONB;
  cat_label    TEXT;
  cat_required INT;
  cat_keywords TEXT[];
  matching_admins INT;
  coverage_pct NUMERIC;
  axis_obj     JSONB;
BEGIN
  -- Collect admin (role='admin') approved members of this club
  SELECT array_agg(cm.user_id)
    INTO v_admin_ids
  FROM club_members cm
  WHERE cm.club_id = p_club_id
    AND cm.role = 'admin'
    AND cm.status = 'approved';

  IF v_admin_ids IS NULL OR array_length(v_admin_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'error', 'No admin members found for this club.',
      'board_size', 0,
      'axes', '[]'::JSONB,
      'warnings', '[]'::JSONB,
      'skill_diversity', 0
    );
  END IF;

  v_total_members := array_length(v_admin_ids, 1);

  -- Aggregate all skills across the board
  SELECT array_agg(DISTINCT lower(s))
    INTO v_all_skills
  FROM unnest(v_admin_ids) AS uid
  JOIN profiles p ON p.id = uid
  JOIN unnest(p.skills) AS s ON true;

  IF v_all_skills IS NULL THEN v_all_skills := '{}'::TEXT[]; END IF;

  -- Calculate skill diversity (unique skills / board size)
  v_skill_diversity := CASE
    WHEN v_total_members > 0
    THEN round(array_length(v_all_skills, 1)::NUMERIC / v_total_members, 2)
    ELSE 0
  END;

  -- Evaluate each category in the heuristic matrix
  FOR entry IN SELECT * FROM jsonb_array_elements(v_matrix)
  LOOP
    cat_label    := entry->>'category';
    cat_required := (entry->>'required')::INT;
    cat_keywords := ARRAY(
      SELECT jsonb_array_elements_text(entry->'keywords')
    );

    -- Count admins who have at least one skill matching this category
    SELECT count(DISTINCT cm.user_id)
      INTO matching_admins
    FROM club_members cm
    JOIN profiles p ON p.id = cm.user_id
    WHERE cm.club_id = p_club_id
      AND cm.role = 'admin'
      AND cm.status = 'approved'
      AND p.skills && cat_keywords;  -- GIN-indexed overlap

    coverage_pct := CASE
      WHEN v_total_members > 0
      THEN round((matching_admins::NUMERIC / v_total_members) * 100)
      ELSE 0
    END;

    -- Build the radar axis object (0-100 scale for the chart)
    axis_obj := jsonb_build_object(
      'category',      cat_label,
      'coverage',      coverage_pct,
      'matching',      matching_admins,
      'required',      cat_required,
      'sufficient',    matching_admins >= cat_required,
      'fullMark',      100
    );
    v_axes := v_axes || axis_obj;

    -- Generate a warning if coverage is below the required threshold
    IF matching_admins < cat_required THEN
      v_warnings := v_warnings || jsonb_build_object(
        'category',  cat_label,
        'message',   format(
          'Your board lacks %s skills. %s of %s admins have relevant experience.',
          cat_label, matching_admins, v_total_members
        ),
        'missing_keywords', to_jsonb(cat_keywords),
        'severity', CASE
          WHEN matching_admins = 0 THEN 'critical'
          ELSE 'warning'
        END
      );
    END IF;
  END LOOP;

  -- Assemble final result
  v_result := jsonb_build_object(
    'club_id',          p_club_id,
    'board_size',       v_total_members,
    'total_unique_skills', array_length(v_all_skills, 1),
    'skill_diversity',  v_skill_diversity,
    'all_skills',       to_jsonb(v_all_skills),
    'axes',             v_axes,
    'warnings',         v_warnings,
    'health_score',     (
      SELECT round(avg((x->>'coverage')::NUMERIC))
      FROM jsonb_array_elements(v_axes) AS x
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_skill_gap_analysis(UUID) TO authenticated;

-- 2. Helper view: list club admins with their skills (for the
--    recruitment suggestion panel)
CREATE OR REPLACE VIEW club_admin_skills AS
SELECT
  cm.club_id,
  cm.user_id,
  p.full_name,
  p.avatar_url,
  p.handle,
  COALESCE(p.skills, '{}'::TEXT[]) AS skills
FROM club_members cm
JOIN profiles p ON p.id = cm.user_id
WHERE cm.role = 'admin'
  AND cm.status = 'approved';

GRANT SELECT ON club_admin_skills TO authenticated;
