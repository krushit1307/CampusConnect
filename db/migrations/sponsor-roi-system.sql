
-- 1. TABLES
-- ============================================

-- Sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    brand_color VARCHAR(7) DEFAULT '#3B82F6',
    
    -- Tier details
    sponsorship_tier VARCHAR(50) CHECK (sponsorship_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    sponsorship_amount DECIMAL(10,2) NOT NULL,
    sponsorship_start DATE NOT NULL,
    sponsorship_end DATE NOT NULL,
    auto_renew BOOLEAN DEFAULT FALSE,
    
    -- Preferences
    include_attendee_emails BOOLEAN DEFAULT FALSE,
    include_demographics BOOLEAN DEFAULT TRUE,
    include_social_mentions BOOLEAN DEFAULT TRUE,
    report_frequency VARCHAR(50) DEFAULT 'quarterly' 
        CHECK (report_frequency IN ('monthly', 'quarterly', 'biannual', 'annual', 'per_event')),
    
    -- Stats
    total_investment DECIMAL(10,2) DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    last_report_generated TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Sponsored events
CREATE TABLE IF NOT EXISTS sponsored_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL,
    event_id UUID NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    event_date TIMESTAMP NOT NULL,
    event_location VARCHAR(255),
    event_type VARCHAR(100),
    
    -- Sponsorship details
    tier_at_event VARCHAR(50),
    amount_paid DECIMAL(10,2) NOT NULL,
    benefits_provided TEXT[],
    
    -- Metrics
    total_attendees INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    brand_mentions INTEGER DEFAULT 0,
    social_shares INTEGER DEFAULT 0,
    promo_code_uses INTEGER DEFAULT 0,
    digital_swag_clicks INTEGER DEFAULT 0,
    booth_visits INTEGER DEFAULT 0,
    lead_captures INTEGER DEFAULT 0,
    
    -- Engagement
    avg_time_spent_minutes INTEGER DEFAULT 0,
    return_visitors INTEGER DEFAULT 0,
    email_opens INTEGER DEFAULT 0,
    email_clicks INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    report_generated_at TIMESTAMP,
    report_sent_at TIMESTAMP,
    
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Digital swag bag items
CREATE TABLE IF NOT EXISTS digital_swag_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL,
    event_id UUID,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) CHECK (item_type IN ('promo_code', 'discount', 'freebie', 'digital_download', 'link', 'other')),
    promo_code VARCHAR(100),
    discount_percentage INTEGER CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    redemption_url VARCHAR(500),
    description TEXT,
    image_url VARCHAR(500),
    
    -- Tracking
    total_views INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_redemptions INTEGER DEFAULT 0,
    unique_redemptions INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

-- Sponsor engagement tracking
CREATE TABLE IF NOT EXISTS sponsor_engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL,
    event_id UUID,
    user_id UUID,
    engagement_type VARCHAR(50) CHECK (engagement_type IN (
        'booth_visit', 'promo_code_use', 'swag_click', 'lead_capture', 
        'social_share', 'event_attend', 'email_open', 'email_click',
        'website_visit', 'survey_response', 'feedback_submit'
    )),
    engagement_value TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- ROI reports
CREATE TABLE IF NOT EXISTS sponsor_roi_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL,
    event_id UUID,
    report_title VARCHAR(255) NOT NULL,
    report_period_start DATE NOT NULL,
    report_period_end DATE NOT NULL,
    
    -- Metrics
    total_impressions INTEGER,
    total_engagements INTEGER,
    total_conversions INTEGER,
    click_through_rate FLOAT,
    conversion_rate FLOAT,
    cost_per_impression FLOAT,
    cost_per_engagement FLOAT,
    cost_per_conversion FLOAT,
    estimated_reach INTEGER,
    social_media_mentions INTEGER,
    sentiment_score FLOAT,
    
    -- Content
    impact_summary TEXT,
    recommendations TEXT,
    data_highlights JSONB,
    charts_data JSONB,
    
    -- Files
    pdf_url VARCHAR(500),
    pdf_generated_at TIMESTAMP,
    email_sent_at TIMESTAMP,
    email_opened_at TIMESTAMP,
    email_clicked_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sponsors_company ON sponsors(company_name);
CREATE INDEX IF NOT EXISTS idx_sponsors_tier ON sponsors(sponsorship_tier);
CREATE INDEX IF NOT EXISTS idx_sponsored_events_sponsor ON sponsored_events(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsored_events_date ON sponsored_events(event_date);
CREATE INDEX IF NOT EXISTS idx_digital_swag_sponsor ON digital_swag_items(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_engagements_sponsor ON sponsor_engagements(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_engagements_type ON sponsor_engagements(engagement_type);
CREATE INDEX IF NOT EXISTS idx_sponsor_roi_reports_sponsor ON sponsor_roi_reports(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_roi_reports_period ON sponsor_roi_reports(report_period_start, report_period_end);

-- ============================================
-- 3. ROI CALCULATION FUNCTIONS
-- ============================================

-- Function to calculate ROI metrics for a sponsor
CREATE OR REPLACE FUNCTION calculate_sponsor_roi(
    sponsor_id UUID,
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 year',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_impressions BIGINT,
    total_engagements BIGINT,
    total_conversions BIGINT,
    click_through_rate FLOAT,
    conversion_rate FLOAT,
    estimated_reach BIGINT,
    social_mentions BIGINT,
    avg_sentiment FLOAT,
    cost_per_impression FLOAT,
    cost_per_engagement FLOAT,
    cost_per_conversion FLOAT,
    roi_percentage FLOAT
) AS $$
DECLARE
    total_investment DECIMAL(10,2);
    total_impressions_val BIGINT := 0;
    total_engagements_val BIGINT := 0;
    total_conversions_val BIGINT := 0;
    social_mentions_val BIGINT := 0;
    avg_sentiment_val FLOAT := 0;
    estimated_reach_val BIGINT := 0;
BEGIN
    -- Get total investment
    SELECT COALESCE(SUM(amount_paid), 0) INTO total_investment
    FROM sponsored_events
    WHERE sponsor_id = sponsor_id
    AND event_date BETWEEN start_date AND end_date;
    
    -- Calculate impressions (attendees * multiplier for brand exposure)
    SELECT COALESCE(SUM(total_attendees * 3), 0) INTO total_impressions_val
    FROM sponsored_events
    WHERE sponsor_id = sponsor_id
    AND event_date BETWEEN start_date AND end_date;
    
    -- Calculate engagements
    SELECT COUNT(*) INTO total_engagements_val
    FROM sponsor_engagements
    WHERE sponsor_id = sponsor_id
    AND created_at BETWEEN start_date AND end_date;
    
    -- Calculate conversions (promo code uses + lead captures)
    SELECT COUNT(*) INTO total_conversions_val
    FROM sponsor_engagements
    WHERE sponsor_id = sponsor_id
    AND engagement_type IN ('promo_code_use', 'lead_capture')
    AND created_at BETWEEN start_date AND end_date;
    
    -- Calculate social mentions
    SELECT COUNT(*) INTO social_mentions_val
    FROM sponsor_engagements
    WHERE sponsor_id = sponsor_id
    AND engagement_type = 'social_share'
    AND created_at BETWEEN start_date AND end_date;
    
    -- Calculate sentiment (average)
    SELECT COALESCE(AVG((metadata->>'sentiment_score')::FLOAT), 0) INTO avg_sentiment_val
    FROM sponsor_engagements
    WHERE sponsor_id = sponsor_id
    AND metadata ? 'sentiment_score'
    AND created_at BETWEEN start_date AND end_date;
    
    -- Estimate reach (unique visitors)
    SELECT COUNT(DISTINCT user_id) INTO estimated_reach_val
    FROM sponsor_engagements
    WHERE sponsor_id = sponsor_id
    AND created_at BETWEEN start_date AND end_date;
    
    -- Calculate rates
    click_through_rate := CASE 
        WHEN total_impressions_val > 0 THEN (total_engagements_val::FLOAT / total_impressions_val::FLOAT) * 100
        ELSE 0
    END;
    
    conversion_rate := CASE 
        WHEN total_engagements_val > 0 THEN (total_conversions_val::FLOAT / total_engagements_val::FLOAT) * 100
        ELSE 0
    END;
    
    -- Calculate costs
    cost_per_impression := CASE 
        WHEN total_impressions_val > 0 THEN total_investment::FLOAT / total_impressions_val::FLOAT
        ELSE 0
    END;
    
    cost_per_engagement := CASE 
        WHEN total_engagements_val > 0 THEN total_investment::FLOAT / total_engagements_val::FLOAT
        ELSE 0
    END;
    
    cost_per_conversion := CASE 
        WHEN total_conversions_val > 0 THEN total_investment::FLOAT / total_conversions_val::FLOAT
        ELSE 0
    END;
    
    -- ROI (assuming average customer lifetime value = $100)
    roi_percentage := CASE 
        WHEN total_investment > 0 THEN ((total_conversions_val * 100 - total_investment) / total_investment) * 100
        ELSE 0
    END;
    
    RETURN QUERY SELECT 
        total_impressions_val,
        total_engagements_val,
        total_conversions_val,
        click_through_rate,
        conversion_rate,
        estimated_reach_val,
        social_mentions_val,
        avg_sentiment_val,
        cost_per_impression,
        cost_per_engagement,
        cost_per_conversion,
        roi_percentage;
END;
$$ LANGUAGE plpgsql;

-- Function to generate ROI report data
CREATE OR REPLACE FUNCTION generate_roi_report(
    sponsor_id UUID,
    event_id UUID DEFAULT NULL
)
RETURNS TABLE (
    report_json JSONB
) AS $$
DECLARE
    sponsor_record RECORD;
    event_record RECORD;
    roi_metrics RECORD;
    swag_stats RECORD;
    engagement_timeline JSONB;
    demographics JSONB;
    impact_summary TEXT;
    recommendations TEXT;
BEGIN
    -- Get sponsor details
    SELECT * INTO sponsor_record FROM sponsors WHERE id = sponsor_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sponsor not found';
    END IF;
    
    -- Get event details
    IF event_id IS NOT NULL THEN
        SELECT * INTO event_record FROM sponsored_events WHERE id = event_id;
    END IF;
    
    -- Calculate ROI metrics
    SELECT * INTO roi_metrics 
    FROM calculate_sponsor_roi(sponsor_id);
    
    -- Get swag bag statistics
    SELECT 
        COALESCE(SUM(total_views), 0) AS total_views,
        COALESCE(SUM(total_clicks), 0) AS total_clicks,
        COALESCE(SUM(total_redemptions), 0) AS total_redemptions,
        AVG(discount_percentage) AS avg_discount
    INTO swag_stats
    FROM digital_swag_items
    WHERE sponsor_id = sponsor_id;
    
    -- Get engagement timeline
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', DATE(created_at),
            'engagements', COUNT(*),
            'type', engagement_type
        )
    ) INTO engagement_timeline
    FROM sponsor_engagements
    WHERE sponsor_id = sponsor_id
    AND created_at >= (CURRENT_DATE - INTERVAL '1 year')
    GROUP BY DATE(created_at), engagement_type
    ORDER BY DATE(created_at);
    
    -- Get demographics (simplified)
    demographics := jsonb_build_object(
        'students', (
            SELECT COUNT(DISTINCT user_id) 
            FROM sponsor_engagements 
            WHERE sponsor_id = sponsor_id
            AND user_id IN (SELECT id FROM profiles WHERE role = 'student')
        ),
        'alumni', (
            SELECT COUNT(DISTINCT user_id) 
            FROM sponsor_engagements 
            WHERE sponsor_id = sponsor_id
            AND user_id IN (SELECT id FROM profiles WHERE role = 'alumni')
        ),
        'faculty', (
            SELECT COUNT(DISTINCT user_id) 
            FROM sponsor_engagements 
            WHERE sponsor_id = sponsor_id
            AND user_id IN (SELECT id FROM profiles WHERE role = 'faculty')
        )
    );
    
    -- Generate impact summary using LLM (placeholder - actual implementation would call OpenAI/Claude API)
    impact_summary := format(
        E'During the sponsorship period, %s achieved remarkable brand visibility with %s total impressions and %s engagements.\n\n' ||
        E'Key highlights include:\n' ||
        E'• %s %% click-through rate, significantly above industry average of 2%%\n' ||
        E'• %s social media mentions, increasing brand awareness\n' ||
        E'• %s promo code redemptions and lead captures\n' ||
        E'• %s %% conversion rate from engaged prospects\n\n' ||
        E'The sponsorship generated an estimated ROI of %s %%, making it a highly effective marketing investment.',
        sponsor_record.company_name,
        TO_CHAR(roi_metrics.total_impressions, 'FM9,999,999'),
        TO_CHAR(roi_metrics.total_engagements, 'FM9,999,999'),
        ROUND(roi_metrics.click_through_rate, 1),
        TO_CHAR(roi_metrics.social_mentions, 'FM999,999'),
        TO_CHAR(roi_metrics.total_conversions, 'FM999,999'),
        ROUND(roi_metrics.conversion_rate, 1),
        ROUND(roi_metrics.roi_percentage, 0)
    );
    
    -- Generate recommendations
    recommendations := format(
        E'Based on the performance data, we recommend:\n\n' ||
        E'1. %s\n' ||
        E'2. %s\n' ||
        E'3. %s',
        CASE 
            WHEN roi_metrics.click_through_rate > 3 THEN 'Maintain current sponsorship tier - excellent engagement'
            ELSE 'Consider upgrading to Gold tier for additional visibility'
        END,
        CASE 
            WHEN roi_metrics.total_conversions > 50 THEN 'Expand sponsorship to additional events'
            ELSE 'Increase digital presence and interactive elements'
        END,
        CASE 
            WHEN swag_stats.total_redemptions > 100 THEN 'Continue offering promo codes - highly effective'
            ELSE 'Redevelop promotional offers for better conversion'
        END
    );
    
    -- Build full report JSON
    report_json := jsonb_build_object(
        'sponsor', jsonb_build_object(
            'id', sponsor_record.id,
            'company_name', sponsor_record.company_name,
            'contact_name', sponsor_record.contact_name,
            'contact_email', sponsor_record.contact_email,
            'brand_color', sponsor_record.brand_color
        ),
        'event', CASE WHEN event_record.id IS NOT NULL THEN 
            jsonb_build_object(
                'id', event_record.id,
                'name', event_record.event_name,
                'date', event_record.event_date,
                'location', event_record.event_location,
                'tier', event_record.tier_at_event,
                'amount', event_record.amount_paid
            )
        ELSE NULL END,
        'metrics', jsonb_build_object(
            'total_impressions', roi_metrics.total_impressions,
            'total_engagements', roi_metrics.total_engagements,
            'total_conversions', roi_metrics.total_conversions,
            'click_through_rate', roi_metrics.click_through_rate,
            'conversion_rate', roi_metrics.conversion_rate,
            'estimated_reach', roi_metrics.estimated_reach,
            'social_mentions', roi_metrics.social_mentions,
            'avg_sentiment', roi_metrics.avg_sentiment,
            'cost_per_impression', roi_metrics.cost_per_impression,
            'cost_per_engagement', roi_metrics.cost_per_engagement,
            'cost_per_conversion', roi_metrics.cost_per_conversion,
            'roi_percentage', roi_metrics.roi_percentage
        ),
        'swag_stats', jsonb_build_object(
            'total_views', swag_stats.total_views,
            'total_clicks', swag_stats.total_clicks,
            'total_redemptions', swag_stats.total_redemptions,
            'avg_discount', swag_stats.avg_discount
        ),
        'demographics', demographics,
        'timeline', engagement_timeline,
        'impact_summary', impact_summary,
        'recommendations', recommendations,
        'generated_at', CURRENT_TIMESTAMP
    );
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate reports for completed events
CREATE OR REPLACE FUNCTION auto_generate_sponsor_reports()
RETURNS VOID AS $$
DECLARE
    event_record RECORD;
    report_data RECORD;
    report_id UUID;
BEGIN
    -- Find events that ended 7 days ago and don't have reports
    FOR event_record IN 
        SELECT 
            se.*,
            s.company_name,
            s.contact_email,
            s.brand_color
        FROM sponsored_events se
        JOIN sponsors s ON se.sponsor_id = s.id
        WHERE se.event_date < CURRENT_DATE - INTERVAL '7 days'
        AND se.report_generated_at IS NULL
        AND s.is_active = TRUE
    LOOP
        -- Generate report
        SELECT * INTO report_data 
        FROM generate_roi_report(event_record.sponsor_id, event_record.id);
        
        -- Insert report record
        INSERT INTO sponsor_roi_reports (
            sponsor_id,
            event_id,
            report_title,
            report_period_start,
            report_period_end,
            total_impressions,
            total_engagements,
            total_conversions,
            click_through_rate,
            conversion_rate,
            cost_per_impression,
            cost_per_engagement,
            cost_per_conversion,
            estimated_reach,
            social_media_mentions,
            sentiment_score,
            impact_summary,
            recommendations,
            data_highlights,
            charts_data,
            pdf_generated_at
        )
        SELECT 
            event_record.sponsor_id,
            event_record.id,
            format('Sponsorship Impact Report: %s - %s', event_record.company_name, event_record.event_name),
            event_record.event_date,
            event_record.event_date + INTERVAL '7 days',
            (report_data.report_json->'metrics'->>'total_impressions')::INTEGER,
            (report_data.report_json->'metrics'->>'total_engagements')::INTEGER,
            (report_data.report_json->'metrics'->>'total_conversions')::INTEGER,
            (report_data.report_json->'metrics'->>'click_through_rate')::FLOAT,
            (report_data.report_json->'metrics'->>'conversion_rate')::FLOAT,
            (report_data.report_json->'metrics'->>'cost_per_impression')::FLOAT,
            (report_data.report_json->'metrics'->>'cost_per_engagement')::FLOAT,
            (report_data.report_json->'metrics'->>'cost_per_conversion')::FLOAT,
            (report_data.report_json->'metrics'->>'estimated_reach')::INTEGER,
            (report_data.report_json->'metrics'->>'social_mentions')::INTEGER,
            (report_data.report_json->'metrics'->>'avg_sentiment')::FLOAT,
            report_data.report_json->>'impact_summary',
            report_data.report_json->>'recommendations',
            report_data.report_json->'metrics',
            report_data.report_json->'timeline',
            CURRENT_TIMESTAMP
        RETURNING id INTO report_id;
        
        -- Update event
        UPDATE sponsored_events 
        SET report_generated_at = CURRENT_TIMESTAMP 
        WHERE id = event_record.id;
        
        -- Queue email (would be handled by a worker)
        INSERT INTO email_queue (
            to_email,
            subject,
            template_name,
            template_data,
            scheduled_for
        ) VALUES (
            event_record.contact_email,
            format('Your Sponsorship Impact Report for %s', event_record.event_name),
            'sponsor_impact_report',
            jsonb_build_object(
                'report_id', report_id,
                'company_name', event_record.company_name,
                'event_name', event_record.event_name,
                'brand_color', event_record.brand_color
            ),
            NOW()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. VIEWS
-- ============================================

-- View for sponsor dashboard
CREATE OR REPLACE VIEW sponsor_dashboard AS
SELECT 
    s.id,
    s.company_name,
    s.sponsorship_tier,
    s.sponsorship_amount,
    s.total_investment,
    s.total_impressions,
    s.total_clicks,
    s.total_conversions,
    s.last_report_generated,
    COUNT(DISTINCT se.id) AS total_events,
    COUNT(DISTINCT sr.id) AS total_reports,
    AVG(sr.sentiment_score) AS avg_sentiment,
    SUM(sr.total_impressions) AS total_impressions_all,
    SUM(sr.total_engagements) AS total_engagements_all,
    SUM(sr.total_conversions) AS total_conversions_all,
    CASE 
        WHEN SUM(sr.total_impressions) > 0 
        THEN (SUM(sr.total_engagements)::FLOAT / SUM(sr.total_impressions)::FLOAT) * 100
        ELSE 0
    END AS overall_ctr,
    CASE 
        WHEN s.sponsorship_amount > 0 
        THEN (SUM(sr.total_conversions) * 100 / s.sponsorship_amount) * 100
        ELSE 0
    END AS roi_percentage
FROM sponsors s
LEFT JOIN sponsored_events se ON s.id = se.sponsor_id
LEFT JOIN sponsor_roi_reports sr ON s.id = sr.sponsor_id
WHERE s.is_active = TRUE
GROUP BY s.id, s.company_name, s.sponsorship_tier, s.sponsorship_amount, s.total_investment, s.total_impressions, s.total_clicks, s.total_conversions, s.last_report_generated;

-- ============================================
-- 5. SAMPLE DATA
-- ============================================

-- Insert sample sponsors
INSERT INTO sponsors (company_name, contact_name, contact_email, contact_phone, logo_url, brand_color, sponsorship_tier, sponsorship_amount, sponsorship_start, sponsorship_end)
VALUES 
    ('TechCorp Inc.', 'Alice Johnson', 'alice@techcorp.com', '+1-555-0101', 'https://example.com/logo1.png', '#3B82F6', 'gold', 5000.00, '2026-01-01', '2026-12-31'),
    ('HealthPlus', 'Bob Smith', 'bob@healthplus.com', '+1-555-0102', 'https://example.com/logo2.png', '#10B981', 'silver', 2500.00, '2026-01-01', '2026-12-31'),
    ('EduTech Solutions', 'Carol White', 'carol@edutech.com', '+1-555-0103', 'https://example.com/logo3.png', '#8B5CF6', 'gold', 7500.00, '2026-01-01', '2026-12-31');

-- Insert sponsored events
INSERT INTO sponsored_events (sponsor_id, event_id, event_name, event_date, event_location, event_type, tier_at_event, amount_paid, total_attendees, unique_visitors, promo_code_uses, digital_swag_clicks)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'event-001', 'Tech Conference 2026', '2026-08-15 10:00:00', 'Main Auditorium', 'conference', 'gold', 5000.00, 350, 280, 45, 120),
    ('22222222-2222-2222-2222-222222222222', 'event-002', 'Health & Wellness Fair', '2026-08-20 09:00:00', 'Student Center', 'fair', 'silver', 2500.00, 200, 150, 30, 80),
    ('33333333-3333-3333-3333-333333333333', 'event-003', 'Education Technology Summit', '2026-09-01 10:00:00', 'Conference Hall', 'summit', 'gold', 7500.00, 500, 420, 78, 200);

-- Insert digital swag items
INSERT INTO digital_swag_items (sponsor_id, event_id, item_name, item_type, promo_code, discount_percentage, redemption_url, total_views, total_clicks, total_redemptions)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'event-001', 'TechCorp Premium 1-Year License', 'promo_code', 'TECH2026', 20, 'https://techcorp.com/promo', 500, 120, 45),
    ('22222222-2222-2222-2222-222222222222', 'event-002', 'HealthPlus Wellness App', 'digital_download', 'HEALTH2026', 15, 'https://healthplus.com/download', 300, 80, 30),
    ('33333333-3333-3333-3333-333333333333', 'event-003', 'EduTech Learning Platform', 'promo_code', 'EDU2026', 25, 'https://edutech.com/promo', 700, 200, 78);

-- Insert sponsor engagements
INSERT INTO sponsor_engagements (sponsor_id, event_id, user_id, engagement_type, engagement_value, metadata)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'event-001', 'user-001', 'booth_visit', 'TechCorp Booth', '{"duration_minutes": 12, "interest_level": "high"}'::JSONB),
    ('11111111-1111-1111-1111-111111111111', 'event-001', 'user-002', 'promo_code_use', 'TECH2026', '{"discount_applied": 20, "purchase_value": 199.99}'::JSONB),
    ('11111111-1111-1111-1111-111111111111', 'event-001', 'user-003', 'social_share', 'LinkedIn', '{"post_text": "Amazing event by TechCorp!", "sentiment_score": 0.9}'::JSONB);

-- Calculate ROI for sample data
SELECT * FROM calculate_sponsor_roi('11111111-1111-1111-1111-111111111111');

-- Generate sample report
SELECT * FROM generate_roi_report('11111111-1111-1111-1111-111111111111', 'event-001');

-- ============================================
-- 6. USAGE EXAMPLES
-- ============================================

-- Get sponsor dashboard data
/*
SELECT * FROM sponsor_dashboard;
*/

-- Calculate ROI for a specific sponsor
/*
SELECT * FROM calculate_sponsor_roi('your-sponsor-id-here');
*/

-- Generate a report
/*
SELECT * FROM generate_roi_report('your-sponsor-id-here');
*/

-- Auto-generate reports for completed events
/*
SELECT auto_generate_sponsor_reports();
*/

-- Get all reports for a sponsor
/*
SELECT * FROM sponsor_roi_reports WHERE sponsor_id = 'your-sponsor-id-here';
*/

-- ============================================
-- 7. CLEANUP
-- ============================================

/*
DROP VIEW IF EXISTS sponsor_dashboard;
DROP TABLE IF EXISTS sponsor_roi_reports;
DROP TABLE IF EXISTS sponsor_engagements;
DROP TABLE IF EXISTS digital_swag_items;
DROP TABLE IF EXISTS sponsored_events;
DROP TABLE IF EXISTS sponsors;
DROP FUNCTION IF EXISTS auto_generate_sponsor_reports();
DROP FUNCTION IF EXISTS generate_roi_report(UUID, UUID);
DROP FUNCTION IF EXISTS calculate_sponsor_roi(UUID, DATE, DATE);
*/
