-- Enable Realtime for session-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE guests;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE session_topics;
ALTER PUBLICATION supabase_realtime ADD TABLE picked_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE question_pool;

-- Add comments for documentation
COMMENT ON TABLE sessions IS 'Realtime enabled for session phase/round updates';
COMMENT ON TABLE guests IS 'Realtime enabled for guest joins';
COMMENT ON TABLE votes IS 'Realtime enabled for voting updates';
COMMENT ON TABLE session_topics IS 'Realtime enabled for topic confirmations';
COMMENT ON TABLE picked_questions IS 'Realtime enabled for question picks';
COMMENT ON TABLE question_pool IS 'Realtime enabled for pool updates';
