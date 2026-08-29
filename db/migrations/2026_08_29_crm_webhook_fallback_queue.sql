-- CRM Webhook Fallback Queue Migration
-- Issue #4989: Real-Time "Sponsor Lead" CRM Webhook Fallback Queue
-- Implements exponential backoff retry + DLQ for failed webhook deliveries

-- ============================================
-- 1. WEBHOOK QUEUE TABLE
-- Stores payloads that failed initial delivery
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Sponsor & CRM details
    sponsor_id UUID NOT NULL,
    crm_webhook_url VARCHAR(500) NOT NULL,
    
    -- Payload
    payload JSONB NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,  -- SHA-256 for deduplication
    
    -- Retry state
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'retrying', 'dlq', 'delivered', 'expired')),
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 10,
    
    -- Exponential backoff scheduling
    -- Retry delays: 1min, 5min, 30min, 2hr, 6hr, 12hr, 24hr, 24hr, 24hr, 24hr
    next_retry_at TIMESTAMP,
    last_attempt_at TIMESTAMP,
    
    -- DLQ tracking
    moved_to_dlq_at TIMESTAMP,
    dlq_csv_exported BOOLEAN DEFAULT FALSE,
    sponsor_notified BOOLEAN DEFAULT FALSE,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    
    FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE
);

-- ============================================
-- 2. WEBHOOK ATTEMPT LOG
-- Full audit trail for every delivery attempt
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL,
    
    -- Attempt details
    attempt_number INTEGER NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Response
    http_status INTEGER,
    response_time_ms INTEGER,
    response_body TEXT,
    error_message TEXT,
    
    -- Context
    worker_id VARCHAR(100),
    
    FOREIGN KEY (queue_id) REFERENCES webhook_queue(id) ON DELETE CASCADE
);

-- ============================================
-- 3. WEBHOOK DLQ (Dead-Letter Queue)
-- Items that exhausted all retries
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_dlq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL UNIQUE,
    
    -- Failure summary
    final_error TEXT,
    total_attempts INTEGER NOT NULL,
    first_attempt_at TIMESTAMP NOT NULL,
    last_attempt_at TIMESTAMP NOT NULL,
    time_to_dlq INTERVAL,
    
    -- Export state
    csv_generated_at TIMESTAMP,
    csv_sent_at TIMESTAMP,
    csv_file_path VARCHAR(500),
    
    -- Sponsor notification
    sponsor_notified_at TIMESTAMP,
    notification_method VARCHAR(50),  -- 'email', 'sms', 'both'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (queue_id) REFERENCES webhook_queue(id) ON DELETE CASCADE
);

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX idx_webhook_queue_status ON webhook_queue(status);
CREATE INDEX idx_webhook_queue_next_retry ON webhook_queue(next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_queue_sponsor ON webhook_queue(sponsor_id);
CREATE INDEX idx_webhook_queue_payload_hash ON webhook_queue(payload_hash);
CREATE INDEX idx_webhook_attempts_queue ON webhook_attempts(queue_id);
CREATE INDEX idx_webhook_dlq_created ON webhook_dlq(created_at);

-- ============================================
-- 5. VIEWS
-- ============================================

-- View: Items ready for retry (next_retry_at has passed)
CREATE OR REPLACE VIEW v_webhook_pending_retries AS
SELECT wq.*, s.company_name, s.contact_email
FROM webhook_queue wq
JOIN sponsors s ON s.id = wq.sponsor_id
WHERE wq.status IN ('pending', 'retrying')
  AND (wq.next_retry_at IS NULL OR wq.next_retry_at <= NOW());

-- View: Items that should move to DLQ (exceeded 48h without delivery)
CREATE OR REPLACE VIEW v_webhook_dlq_candidates AS
SELECT wq.*, s.company_name, s.contact_email
FROM webhook_queue wq
JOIN sponsors s ON s.id = wq.sponsor_id
WHERE wq.status IN ('pending', 'retrying')
  AND wq.created_at <= NOW() - INTERVAL '48 hours';

-- View: DLQ statistics by sponsor
CREATE OR REPLACE VIEW v_dlq_sponsor_stats AS
SELECT 
    wq.sponsor_id,
    s.company_name,
    COUNT(*) as total_dlq_items,
    SUM(wdlq.total_attempts) as total_retry_attempts,
    MIN(wdlq.first_attempt_at) as earliest_failure,
    MAX(wdlq.last_attempt_at) as latest_failure
FROM webhook_dlq wdlq
JOIN webhook_queue wq ON wq.id = wdlq.queue_id
JOIN sponsors s ON s.id = wq.sponsor_id
WHERE wdlq.csv_sent_at IS NULL
GROUP BY wq.sponsor_id, s.company_name;
