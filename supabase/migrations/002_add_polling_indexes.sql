-- Add indexes for efficient timestamp-based polling
-- These indexes enable O(log n) incremental queries when polling for new data

-- Index for fetching guests who joined after a specific timestamp
CREATE INDEX IF NOT EXISTS idx_guests_created_at
ON guests(session_id, joined_at);

-- Index for fetching votes created after a specific timestamp
CREATE INDEX IF NOT EXISTS idx_votes_created_at
ON votes(session_id, created_at);

-- Index for fetching picked questions after a specific timestamp
CREATE INDEX IF NOT EXISTS idx_picked_questions_created_at
ON picked_questions(session_id, picked_at);

-- Index for checking if session was updated
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
ON sessions(id, updated_at);

-- Analyze tables for query optimization
ANALYZE guests;
ANALYZE votes;
ANALYZE picked_questions;
ANALYZE sessions;
