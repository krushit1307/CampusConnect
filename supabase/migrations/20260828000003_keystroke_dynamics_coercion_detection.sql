-- ============================================================
-- Migration: 20260828000003_keystroke_dynamics_coercion_detection.sql
-- Issue: #5008 - Automated "Event Feedback" Linguistic Sentiment Drift
-- Description:
--   1. Adds keystroke dynamics fields to event_feedbacks table
--   2. Creates keystroke anomaly scoring function
--   3. Creates coercion detection logic
--   4. Updates rating calculation to discount suspicious reviews
-- ============================================================

SET lock_timeout = '3s';

-- 1. Add keystroke dynamics fields to event_feedbacks table
ALTER TABLE public.event_feedbacks
ADD COLUMN IF NOT EXISTS keystroke_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS keystroke_anomaly_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS avg_dwell_time_ms NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS avg_flight_time_ms NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS backspace_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS correction_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS typing_duration_ms INT,
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS coercion_flagged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS weight_multiplier NUMERIC(3,2) DEFAULT 1.0;

-- Add constraints
ALTER TABLE public.event_feedbacks
ADD CONSTRAINT chk_keystroke_anomaly_score
CHECK (keystroke_anomaly_score IS NULL OR keystroke_anomaly_score >= 0);

ALTER TABLE public.event_feedbacks
ADD CONSTRAINT chk_weight_multiplier
CHECK (weight_multiplier >= 0 AND weight_multiplier <= 1.0);

COMMENT ON COLUMN public.event_feedbacks.keystroke_data IS 'Array of keystroke events: {key, timestamp, dwellTime, flightTime}';
COMMENT ON COLUMN public.event_feedbacks.keystroke_anomaly_score IS 'Calculated anomaly score based on typing patterns (higher = more suspicious)';
COMMENT ON COLUMN public.event_feedbacks.avg_dwell_time_ms IS 'Average time key was held down (milliseconds)';
COMMENT ON COLUMN public.event_feedbacks.avg_flight_time_ms IS 'Average time between keystrokes (milliseconds)';
COMMENT ON COLUMN public.event_feedbacks.backspace_count IS 'Number of backspace/deletion events';
COMMENT ON COLUMN public.event_feedbacks.correction_rate IS 'Ratio of corrections to total keystrokes';
COMMENT ON COLUMN public.event_feedbacks.typing_duration_ms IS 'Total time spent typing the review';
COMMENT ON COLUMN public.event_feedbacks.sentiment_score IS 'NLP sentiment score (-1 to 1, where 1 is positive)';
COMMENT ON COLUMN public.event_feedbacks.is_suspicious IS 'Flagged as potentially coerced based on keystroke analysis';
COMMENT ON COLUMN public.event_feedbacks.coercion_flagged_at IS 'Timestamp when review was flagged as suspicious';
COMMENT ON COLUMN public.event_feedbacks.weight_multiplier IS 'Weight applied to this review in average rating calculation (0-1)';

-- 2. Create function to calculate keystroke anomaly score
CREATE OR REPLACE FUNCTION public.calculate_keystroke_anomaly(
    p_keystroke_data JSONB,
    p_typing_duration_ms INT,
    p_backspace_count INT,
    p_total_keystrokes INT
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_flight_times NUMERIC[] := ARRAY[]::NUMERIC[];
    v_dwell_times NUMERIC[] := ARRAY[]::NUMERIC[];
    v_avg_flight_time NUMERIC;
    v_avg_dwell_time NUMERIC;
    v_flight_stddev NUMERIC;
    v_dwell_stddev NUMERIC;
    v_flight_cv NUMERIC; -- Coefficient of variation
    v_correction_rate NUMERIC;
    v_anomaly_score NUMERIC := 0;
    item JSONB;
BEGIN
    -- Skip if no data
    IF p_keystroke_data IS NULL OR jsonb_array_length(p_keystroke_data) < 5 THEN
        RETURN 0;
    END IF;

    -- Extract flight times and dwell times
    FOR item IN SELECT * FROM jsonb_array_elements(p_keystroke_data)
    LOOP
        IF (item->>'flightTime') IS NOT NULL THEN
            v_flight_times := array_append(v_flight_times, (item->>'flightTime')::NUMERIC);
        END IF;
        IF (item->>'dwellTime') IS NOT NULL THEN
            v_dwell_times := array_append(v_dwell_times, (item->>'dwellTime')::NUMERIC);
        END IF;
    END LOOP;

    -- Calculate averages
    IF array_length(v_flight_times, 1) > 0 THEN
        SELECT AVG(x) INTO v_avg_flight_time FROM unnest(v_flight_times) x;
    END IF;
    
    IF array_length(v_dwell_times, 1) > 0 THEN
        SELECT AVG(x) INTO v_avg_dwell_time FROM unnest(v_dwell_times) x;
    END IF;

    -- Calculate standard deviations
    IF array_length(v_flight_times, 1) > 1 THEN
        SELECT stddev(x) INTO v_flight_stddev FROM unnest(v_flight_times) x;
    END IF;
    
    IF array_length(v_dwell_times, 1) > 1 THEN
        SELECT stddev(x) INTO v_dwell_stddev FROM unnest(v_dwell_times) x;
    END IF;

    -- Calculate coefficient of variation (CV = std/mean)
    -- High CV indicates erratic typing patterns
    IF v_avg_flight_time > 0 AND v_flight_stddev IS NOT NULL THEN
        v_flight_cv := v_flight_stddev / v_avg_flight_time;
    END IF;

    -- Calculate correction rate
    IF p_total_keystrokes > 0 THEN
        v_correction_rate := p_backspace_count::NUMERIC / p_total_keystrokes;
    END IF;

    -- Anomaly scoring (0-100 scale)
    -- High flight CV (> 0.8) = erratic typing = +30 points
    IF v_flight_cv > 0.8 THEN
        v_anomaly_score := v_anomaly_score + 30;
    ELSIF v_flight_cv > 0.6 THEN
        v_anomaly_score := v_anomaly_score + 20;
    ELSIF v_flight_cv > 0.4 THEN
        v_anomaly_score := v_anomaly_score + 10;
    END IF;

    -- High correction rate (> 0.15) = many edits = +40 points
    IF v_correction_rate > 0.15 THEN
        v_anomaly_score := v_anomaly_score + 40;
    ELSIF v_correction_rate > 0.10 THEN
        v_anomaly_score := v_anomaly_score + 30;
    ELSIF v_correction_rate > 0.05 THEN
        v_anomaly_score := v_anomaly_score + 15;
    END IF;

    -- Very short typing duration for long text = rushed = +20 points
    IF p_typing_duration_ms < 5000 AND p_total_keystrokes > 20 THEN
        v_anomaly_score := v_anomaly_score + 20;
    END IF;

    -- Very long dwell times (> 500ms average) = hesitation = +10 points
    IF v_avg_dwell_time > 500 THEN
        v_anomaly_score := v_anomaly_score + 10;
    END IF;

    RETURN v_anomaly_score;
END;
$$;

-- 3. Create function to detect coercion based on keystroke anomaly + sentiment
CREATE OR REPLACE FUNCTION public.detect_coercion(
    p_keystroke_anomaly_score NUMERIC,
    p_sentiment_score NUMERIC,
    p_rating INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_is_coerced BOOLEAN := FALSE;
BEGIN
    -- Coercion detected if:
    -- 1. High keystroke anomaly (> 60) AND
    -- 2. Positive sentiment (> 0.5) AND
    -- 3. High rating (4 or 5)
    
    IF p_keystroke_anomaly_score > 60 
       AND p_sentiment_score > 0.5 
       AND p_rating >= 4 THEN
        v_is_coerced := TRUE;
    END IF;

    -- Also flag if anomaly is extremely high (> 80) regardless of sentiment
    IF p_keystroke_anomaly_score > 80 THEN
        v_is_coerced := TRUE;
    END IF;

    RETURN v_is_coerced;
END;
$$;

-- 4. Create function to calculate weight multiplier based on coercion
CREATE OR REPLACE FUNCTION public.calculate_weight_multiplier(
    p_is_suspicious BOOLEAN,
    p_keystroke_anomaly_score NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- If suspicious, discount weight based on anomaly severity
    IF p_is_suspicious THEN
        IF p_keystroke_anomaly_score > 80 THEN
            RETURN 0.0; -- Completely ignore
        ELSIF p_keystroke_anomaly_score > 70 THEN
            RETURN 0.1; -- 90% discount
        ELSIF p_keystroke_anomaly_score > 60 THEN
            RETURN 0.3; -- 70% discount
        ELSE
            RETURN 0.5; -- 50% discount
        END IF;
    END IF;
    
    RETURN 1.0; -- Full weight
END;
$$;

-- 5. Create RPC to analyze feedback and flag coercion
CREATE OR REPLACE FUNCTION public.analyze_feedback_coercion(p_feedback_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_feedback RECORD;
    v_keystroke_anomaly_score NUMERIC;
    v_is_suspicious BOOLEAN;
    v_weight_multiplier NUMERIC;
    v_total_keystrokes INT;
BEGIN
    -- Get feedback data
    SELECT * INTO v_feedback
    FROM public.event_feedbacks
    WHERE id = p_feedback_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Feedback not found');
    END IF;
    
    -- Calculate total keystrokes
    v_total_keystrokes := jsonb_array_length(v_feedback.keystroke_data);
    
    -- Calculate keystroke anomaly score
    v_keystroke_anomaly_score := public.calculate_keystroke_anomaly(
        v_feedback.keystroke_data,
        v_feedback.typing_duration_ms,
        v_feedback.backspace_count,
        v_total_keystrokes
    );
    
    -- Detect coercion
    v_is_suspicious := public.detect_coercion(
        v_keystroke_anomaly_score,
        v_feedback.sentiment_score,
        v_feedback.rating
    );
    
    -- Calculate weight multiplier
    v_weight_multiplier := public.calculate_weight_multiplier(
        v_is_suspicious,
        v_keystroke_anomaly_score
    );
    
    -- Update feedback record
    UPDATE public.event_feedbacks
    SET 
        keystroke_anomaly_score = v_keystroke_anomaly_score,
        is_suspicious = v_is_suspicious,
        coercion_flagged_at = CASE WHEN v_is_suspicious THEN NOW() ELSE NULL END,
        weight_multiplier = v_weight_multiplier
    WHERE id = p_feedback_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'keystroke_anomaly_score', v_keystroke_anomaly_score,
        'is_suspicious', v_is_suspicious,
        'weight_multiplier', v_weight_multiplier,
        'message', CASE WHEN v_is_suspicious 
            THEN 'Review flagged as suspicious' 
            ELSE 'Review appears genuine' 
        END
    );
END;
$$;

-- 6. Update event average rating to use weighted calculation
CREATE OR REPLACE FUNCTION public.update_event_average_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_event UUID;
BEGIN
    target_event := COALESCE(NEW.event_id, OLD.event_id);

    UPDATE events
    SET average_rating = COALESCE(
        (
            SELECT ROUND(
                SUM(rating * COALESCE(weight_multiplier, 1.0))::NUMERIC / 
                GREATEST(SUM(COALESCE(weight_multiplier, 1.0)), 1),
                2
            )
            FROM event_feedbacks
            WHERE event_id = target_event
        ),
        0
    )
    WHERE id = target_event;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_keystroke_anomaly(JSONB, INT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_coercion(NUMERIC, NUMERIC, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_weight_multiplier(BOOLEAN, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_feedback_coercion(UUID) TO authenticated;
