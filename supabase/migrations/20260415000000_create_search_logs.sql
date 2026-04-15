-- ============================================================================
-- Search Query Logging
-- Purpose: Abuse prevention, content moderation, and quality improvement
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core query data
    query TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Abuse prevention (rate limiting)
    session_id TEXT,  -- Browser session for rate limiting
    user_ip TEXT,     -- IP for rate limiting + blocking abusers

    -- Response tracking (for quality improvement)
    intent TEXT,              -- Detected intent from LLM
    num_sources INT,          -- Number of sources returned
    response_time_ms INT,     -- Performance tracking
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    -- Content moderation
    flagged BOOLEAN DEFAULT false,      -- Manually or automatically flagged
    flag_reason TEXT,                   -- Why it was flagged

    -- Future expansion (nullable for now)
    user_id UUID,  -- Add when you implement auth
    feedback_rating INT CHECK (feedback_rating BETWEEN 1 AND 5)  -- User ratings
);

-- ============================================================================
-- INDEXES for abuse prevention and analytics
-- ============================================================================

-- Rate limiting: Count searches by session/IP in time window
CREATE INDEX search_logs_session_created_idx ON search_logs(session_id, created_at DESC);
CREATE INDEX search_logs_ip_created_idx ON search_logs(user_ip, created_at DESC);

-- Time-based queries
CREATE INDEX search_logs_created_at_idx ON search_logs(created_at DESC);

-- Moderation: Find flagged content
CREATE INDEX search_logs_flagged_idx ON search_logs(flagged) WHERE flagged = true;

-- ============================================================================
-- SECURITY
-- ============================================================================

ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access (secure by default)

-- ============================================================================
-- RATE LIMITING FUNCTION
-- Check if session/IP has exceeded rate limit
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
    p_session_id TEXT,
    p_user_ip TEXT,
    p_max_requests INT DEFAULT 20,  -- Max requests per time window
    p_window_minutes INT DEFAULT 60  -- Time window in minutes
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INT;
BEGIN
    -- Count recent requests from this session or IP
    SELECT COUNT(*) INTO v_count
    FROM search_logs
    WHERE created_at >= NOW() - (p_window_minutes || ' minutes')::INTERVAL
      AND (session_id = p_session_id OR user_ip = p_user_ip);

    -- Return true if under limit, false if over
    RETURN v_count < p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ANALYTICS FUNCTION: Failed/flagged searches
-- ============================================================================

CREATE OR REPLACE FUNCTION get_flagged_searches(
    limit_count INT DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    query TEXT,
    created_at TIMESTAMPTZ,
    flag_reason TEXT,
    user_ip TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT sl.id, sl.query, sl.created_at, sl.flag_reason, sl.user_ip
    FROM search_logs sl
    WHERE sl.flagged = true
    ORDER BY sl.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE search_logs IS 'Logs searches for abuse prevention, moderation, and quality improvement';
COMMENT ON COLUMN search_logs.session_id IS 'Browser session ID for rate limiting (no auth required)';
COMMENT ON COLUMN search_logs.user_ip IS 'User IP for rate limiting and blocking abusers';
COMMENT ON COLUMN search_logs.flagged IS 'Mark inappropriate or abusive searches';
