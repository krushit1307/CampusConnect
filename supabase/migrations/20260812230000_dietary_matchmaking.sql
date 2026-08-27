-- Migration: 20260812230000_dietary_matchmaking.sql
-- Description: Create banquet_tables, banquet_seat_assignments, and analyze_seating_safety RPC
--               for banquet dietary requirement matchmaking and cross-contamination prevention (#3015).

-- 1. Create banquet_tables table
CREATE TABLE IF NOT EXISTS public.banquet_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    table_number INT NOT NULL,
    table_name TEXT NOT NULL,
    capacity INT NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (event_id, table_number)
);

-- 2. Create banquet_seat_assignments table
CREATE TABLE IF NOT EXISTS public.banquet_seat_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID REFERENCES public.banquet_tables(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT,
    dietary_needs TEXT[] DEFAULT '{}',
    severe_allergies TEXT[] DEFAULT '{}',
    meal_choice TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (table_id, user_id)
);

-- Enable RLS
ALTER TABLE public.banquet_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banquet_seat_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers and attendees can view banquet tables" ON public.banquet_tables FOR SELECT USING (TRUE);
CREATE POLICY "Organizers and attendees can view seat assignments" ON public.banquet_seat_assignments FOR SELECT USING (TRUE);

-- 3. RPC function to analyze seating safety for an event
CREATE OR REPLACE FUNCTION public.analyze_seating_safety(p_event_id UUID)
RETURNS TABLE (
    table_id UUID,
    table_number INT,
    table_name TEXT,
    capacity INT,
    total_assigned INT,
    has_critical_warning BOOLEAN,
    critical_warnings TEXT[],
    safety_score INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH table_stats AS (
        SELECT 
            t.id AS t_id,
            t.table_number AS t_num,
            t.table_name AS t_name,
            t.capacity AS t_cap,
            COUNT(s.id)::INT AS t_total,
            -- Check for severe allergy cross-contamination risks
            BOOL_OR(
                ARRAY_LENGTH(s.severe_allergies, 1) > 0 AND EXISTS (
                    SELECT 1 FROM public.banquet_seat_assignments s2
                    WHERE s2.table_id = t.id AND s2.meal_choice IS NOT NULL AND (
                        (s.severe_allergies @> ARRAY['Peanuts'] AND LOWER(s2.meal_choice) LIKE '%peanut%') OR
                        (s.severe_allergies @> ARRAY['Gluten'] AND LOWER(s2.meal_choice) LIKE '%gluten%') OR
                        (s.severe_allergies @> ARRAY['Shellfish'] AND LOWER(s2.meal_choice) LIKE '%shellfish%')
                    )
                )
            ) AS t_warn
        FROM public.banquet_tables t
        LEFT JOIN public.banquet_seat_assignments s ON s.table_id = t.id
        WHERE t.event_id = p_event_id
        GROUP BY t.id, t.table_number, t.table_name, t.capacity
    )
    SELECT 
        ts.t_id,
        ts.t_num,
        ts.t_name,
        ts.t_cap,
        ts.t_total,
        COALESCE(ts.t_warn, FALSE) AS has_critical_warning,
        CASE 
            WHEN COALESCE(ts.t_warn, FALSE) THEN ARRAY['CRITICAL_WARNING: Severe allergen cross-contamination risk at this table!']
            ELSE ARRAY[]::TEXT[]
        END AS critical_warnings,
        CASE 
            WHEN COALESCE(ts.t_warn, FALSE) THEN 0
            ELSE 100
        END AS safety_score
    FROM table_stats ts
    ORDER BY ts.t_num ASC;
END;
$$;
