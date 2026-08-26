
-- ============================================

-- ============================================
-- 1. TABLES
-- ============================================

-- Main feedback table (ALL FIELDS INCLUDED)
CREATE TABLE IF NOT EXISTS event_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    user_id UUID,
    feedback_text TEXT NOT NULL,
    feedback_type VARCHAR(50) DEFAULT 'survey' 
        CHECK (feedback_type IN ('survey', 'live_qa', 'quick_reaction', 'comment')),
    
    -- Metadata
    sentiment_score FLOAT, -- -1 to 1 (negative to positive)
    sentiment_label VARCHAR(20), -- positive, negative, neutral
    word_count INTEGER,
    character_count INTEGER,
    
    -- Context
    question_asked VARCHAR(500),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_highlighted BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
);

-- Pre-computed word frequencies (for performance)
CREATE TABLE IF NOT EXISTS feedback_word_frequencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    word VARCHAR(100) NOT NULL,
    frequency INTEGER DEFAULT 0,
    sentiment_impact FLOAT DEFAULT 0, -- Positive/negative weight
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(event_id, word),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Feedback highlights (for important feedback)
CREATE TABLE IF NOT EXISTS feedback_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    feedback_id UUID REFERENCES event_feedback(id) ON DELETE CASCADE,
    highlight_reason VARCHAR(255),
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_event_feedback_event_id ON event_feedback(event_id);
CREATE INDEX IF NOT EXISTS idx_event_feedback_created_at ON event_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_event_feedback_sentiment ON event_feedback(sentiment_label);
CREATE INDEX IF NOT EXISTS idx_word_frequencies_event_id ON feedback_word_frequencies(event_id);
CREATE INDEX IF NOT EXISTS idx_word_frequencies_frequency ON feedback_word_frequencies(frequency DESC);

-- Full-text search for feedback
CREATE INDEX IF NOT EXISTS idx_event_feedback_text_gin ON event_feedback USING gin(to_tsvector('english', feedback_text));

-- ============================================
-- 3. NLP FUNCTIONS
-- ============================================

-- Stop words for tokenization
CREATE TABLE IF NOT EXISTS stop_words (
    word VARCHAR(50) PRIMARY KEY
);

-- Insert common English stop words
INSERT INTO stop_words (word) VALUES
('a', 'an', 'the', 'and', 'or', 'but', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'with', 'without'),
('of', 'for', 'on', 'at', 'to', 'in', 'with', 'without', 'by', 'about', 'as', 'into', 'like'),
('through', 'after', 'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under'),
('around', 'among', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your'),
('yours', 'yourself', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its'),
('itself', 'they', 'them', 'their', 'theirs', 'themselves', 'am', 'is', 'are', 'was', 'were', 'be'),
('being', 'been', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'will', 'would'),
('shall', 'should', 'may', 'might', 'must', 'can', 'could', 'yes', 'no', 'not', 'very', 'too');

-- Function to tokenize and remove stop words
CREATE OR REPLACE FUNCTION tokenize_feedback(text_input TEXT)
RETURNS TEXT[] AS $$
DECLARE
    words TEXT[];
    cleaned_words TEXT[];
    stop_words_array TEXT[];
BEGIN
    -- Convert to lowercase and split into words
    words := regexp_split_to_array(lower(text_input), '[^a-z0-9'']+');
    
    -- Get stop words
    SELECT array_agg(word) INTO stop_words_array FROM stop_words;
    
    -- Filter out stop words and short words (< 2 chars)
    SELECT array_agg(word) INTO cleaned_words
    FROM unnest(words) AS word
    WHERE 
        word IS NOT NULL 
        AND word != ''
        AND length(word) >= 2
        AND word NOT IN (SELECT unnest(stop_words_array))
        -- Remove numbers and special characters
        AND word ~ '^[a-z]+$';
    
    RETURN cleaned_words;
END;
$$ LANGUAGE plpgsql;

-- Function to update word frequencies
CREATE OR REPLACE FUNCTION update_word_frequencies(event_uuid UUID)
RETURNS VOID AS $$
DECLARE
    feedback_record RECORD;
    word TEXT;
    word_freq RECORD;
BEGIN
    -- Delete old frequencies for this event
    DELETE FROM feedback_word_frequencies WHERE event_id = event_uuid;
    
    -- Process each feedback
    FOR feedback_record IN 
        SELECT feedback_text FROM event_feedback WHERE event_id = event_uuid
    LOOP
        -- Tokenize and count words
        FOR word IN 
            SELECT unnest(tokenize_feedback(feedback_record.feedback_text))
        LOOP
            -- Insert or update frequency
            INSERT INTO feedback_word_frequencies (event_id, word, frequency)
            VALUES (event_uuid, word, 1)
            ON CONFLICT (event_id, word)
            DO UPDATE SET frequency = feedback_word_frequencies.frequency + 1;
        END LOOP;
    END LOOP;
    
    -- Update sentiment impact (simple heuristic)
    FOR word_freq IN 
        SELECT word, frequency FROM feedback_word_frequencies 
        WHERE event_id = event_uuid
    LOOP
        UPDATE feedback_word_frequencies
        SET sentiment_impact = 
            CASE 
                WHEN word IN ('awesome', 'great', 'amazing', 'excellent', 'wonderful', 'fantastic', 'perfect', 'love', 'best') 
                    THEN frequency * 1.5
                WHEN word IN ('bad', 'terrible', 'awful', 'horrible', 'worst', 'boring', 'disappointing', 'hate') 
                    THEN frequency * -1.5
                WHEN word IN ('cold', 'hot', 'late', 'early', 'long', 'short', 'loud', 'quiet') 
                    THEN frequency * 0.5
                ELSE frequency * 0.3
            END
        WHERE event_id = event_uuid AND word = word_freq.word;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update frequencies on new feedback
CREATE OR REPLACE FUNCTION trigger_update_word_frequencies()
RETURNS TRIGGER AS $$
BEGIN
    -- Update frequencies asynchronously
    PERFORM pg_notify('update_word_frequencies', NEW.event_id::TEXT);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_word_frequencies_on_insert
    AFTER INSERT ON event_feedback
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_word_frequencies();

-- Function to get word cloud data
CREATE OR REPLACE FUNCTION get_word_cloud_data(
    event_uuid UUID,
    min_frequency INT DEFAULT 1,
    max_words INT DEFAULT 100
)
RETURNS TABLE (
    word TEXT,
    frequency BIGINT,
    sentiment_impact FLOAT,
    size INTEGER,
    color VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.word,
        f.frequency::BIGINT,
        f.sentiment_impact,
        -- Size based on frequency (scaled 10-60)
        LEAST(GREATEST(10 + (f.frequency * 2), 10), 60)::INTEGER AS size,
        -- Color based on sentiment
        CASE 
            WHEN f.sentiment_impact > 5 THEN '#22c55e'    -- green (positive)
            WHEN f.sentiment_impact > 0 THEN '#84cc16'    -- lime (slightly positive)
            WHEN f.sentiment_impact > -5 THEN '#eab308'   -- yellow (neutral)
            WHEN f.sentiment_impact > -10 THEN '#f97316'  -- orange (slightly negative)
            ELSE '#ef4444'                                 -- red (negative)
        END AS color
    FROM feedback_word_frequencies f
    WHERE 
        f.event_id = event_uuid
        AND f.frequency >= min_frequency
    ORDER BY f.frequency DESC
    LIMIT max_words;
END;
$$ LANGUAGE plpgsql;

-- Function to search feedback containing a word
CREATE OR REPLACE FUNCTION search_feedback_by_word(
    event_uuid UUID,
    search_word TEXT
)
RETURNS TABLE (
    id UUID,
    feedback_text TEXT,
    user_name VARCHAR(255),
    created_at TIMESTAMP,
    sentiment_label VARCHAR(20),
    context_preview TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.feedback_text,
        p.full_name AS user_name,
        f.created_at,
        f.sentiment_label,
        -- Show context with the word highlighted
        regexp_replace(
            f.feedback_text, 
            search_word, 
            '***' || search_word || '***', 
            'gi'
        ) AS context_preview
    FROM event_feedback f
    LEFT JOIN profiles p ON f.user_id = p.id
    WHERE 
        f.event_id = event_uuid
        AND f.feedback_text ILIKE '%' || search_word || '%'
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. SENTIMENT ANALYSIS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION analyze_sentiment(text_input TEXT)
RETURNS TABLE (
    score FLOAT,
    label VARCHAR(20)
) AS $$
DECLARE
    positive_words TEXT[] := ARRAY['awesome', 'great', 'amazing', 'excellent', 'wonderful', 'fantastic', 'perfect', 'love', 'best', 'good', 'nice', 'cool', 'brilliant', 'outstanding', 'superb'];
    negative_words TEXT[] := ARRAY['bad', 'terrible', 'awful', 'horrible', 'worst', 'boring', 'disappointing', 'hate', 'poor', 'unacceptable', 'disgusting', 'horrific', 'atrocious'];
    positive_count INTEGER := 0;
    negative_count INTEGER := 0;
    word TEXT;
BEGIN
    -- Tokenize the text
    FOR word IN SELECT unnest(tokenize_feedback(text_input))
    LOOP
        IF word = ANY(positive_words) THEN
            positive_count := positive_count + 1;
        ELSIF word = ANY(negative_words) THEN
            negative_count := negative_count + 1;
        END IF;
    END LOOP;
    
    -- Calculate sentiment score
    score := CASE 
        WHEN positive_count + negative_count = 0 THEN 0
        ELSE (positive_count - negative_count)::FLOAT / (positive_count + negative_count)::FLOAT
    END;
    
    -- Determine label
    label := CASE 
        WHEN score > 0.3 THEN 'positive'
        WHEN score < -0.3 THEN 'negative'
        ELSE 'neutral'
    END;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. VIEWS FOR DASHBOARD
-- ============================================

-- View for event feedback summary
CREATE OR REPLACE VIEW event_feedback_summary AS
SELECT 
    e.id AS event_id,
    e.title AS event_title,
    COUNT(f.id) AS total_feedback,
    COUNT(DISTINCT f.user_id) AS unique_respondents,
    AVG(f.rating) AS average_rating,
    SUM(CASE WHEN f.sentiment_label = 'positive' THEN 1 ELSE 0 END) AS positive_count,
    SUM(CASE WHEN f.sentiment_label = 'neutral' THEN 1 ELSE 0 END) AS neutral_count,
    SUM(CASE WHEN f.sentiment_label = 'negative' THEN 1 ELSE 0 END) AS negative_count,
    MAX(f.created_at) AS latest_feedback,
    MIN(f.created_at) AS earliest_feedback
FROM events e
LEFT JOIN event_feedback f ON e.id = f.event_id
GROUP BY e.id, e.title;

-- View for trending words (real-time)
CREATE OR REPLACE VIEW trending_words AS
SELECT 
    fw.event_id,
    fw.word,
    fw.frequency,
    fw.sentiment_impact,
    e.title AS event_title,
    RANK() OVER (PARTITION BY fw.event_id ORDER BY fw.frequency DESC) AS rank
FROM feedback_word_frequencies fw
JOIN events e ON fw.event_id = e.id
WHERE fw.last_updated > CURRENT_TIMESTAMP - INTERVAL '1 hour';

-- ============================================
-- 6. SAMPLE DATA
-- ============================================

-- Insert sample feedback
INSERT INTO event_feedback (event_id, user_id, feedback_text, feedback_type, rating, sentiment_score, sentiment_label) 
VALUES 
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 
     'The pizza was amazing and the speakers were fantastic!', 'survey', 5, 0.8, 'positive'),
    
    ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
     'The room was too cold and the microphone was loud', 'survey', 3, -0.2, 'neutral'),
    
    ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444',
     'Awesome event! Great networking opportunities.', 'quick_reaction', 5, 0.9, 'positive'),
    
    ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
     'The food was cold and the schedule was too long', 'survey', 2, -0.5, 'negative'),
    
    ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666',
     'Perfect location, wonderful speakers, and delicious pizza!', 'survey', 5, 0.9, 'positive');

-- Generate word frequencies for sample data
SELECT update_word_frequencies('11111111-1111-1111-1111-111111111111');

-- ============================================
-- 7. USAGE EXAMPLES
-- ============================================

-- Get word cloud data for an event
/*
SELECT * FROM get_word_cloud_data('your-event-id-here');
*/

-- Search feedback containing a word
/*
SELECT * FROM search_feedback_by_word('your-event-id-here', 'pizza');
*/

-- Get sentiment analysis for new feedback
/*
INSERT INTO event_feedback (event_id, feedback_text, sentiment_score, sentiment_label)
SELECT 
    'your-event-id-here',
    'This is an amazing event!',
    (analyze_sentiment('This is an amazing event!')).score,
    (analyze_sentiment('This is an amazing event!')).label;
*/

-- Get event summary
/*
SELECT * FROM event_feedback_summary WHERE event_id = 'your-event-id-here';
*/

-- Get trending words
/*
SELECT * FROM trending_words WHERE event_id = 'your-event-id-here' LIMIT 20;
*/

-- ============================================
-- 8. CLEANUP
-- ============================================

/*
DROP VIEW IF EXISTS trending_words;
DROP VIEW IF EXISTS event_feedback_summary;
DROP TABLE IF EXISTS feedback_highlights;
DROP TABLE IF EXISTS feedback_word_frequencies;
DROP TABLE IF EXISTS event_feedback;
DROP TABLE IF EXISTS stop_words;
DROP FUNCTION IF EXISTS get_word_cloud_data(UUID, INT, INT);
DROP FUNCTION IF EXISTS search_feedback_by_word(UUID, TEXT);
DROP FUNCTION IF EXISTS analyze_sentiment(TEXT);
DROP FUNCTION IF EXISTS update_word_frequencies(UUID);
DROP FUNCTION IF EXISTS tokenize_feedback(TEXT);
DROP FUNCTION IF EXISTS trigger_update_word_frequencies();
*/
