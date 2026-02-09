-- Add transaction support for all critical multi-step operations
-- This migration adds atomic RPC functions to prevent race conditions and partial failures

-- ============================================================================
-- Phase 1: pick_question_atomic - Prevents race conditions when picking questions
-- ============================================================================
CREATE OR REPLACE FUNCTION pick_question_atomic(
  p_session_id UUID,
  p_guest_id UUID,
  p_round INT
)
RETURNS JSONB AS $$
DECLARE
  v_pool_record RECORD;
  v_question_record RECORD;
BEGIN
  -- Lock and select next available question (prevents race condition)
  SELECT id, question_id
  INTO v_pool_record
  FROM question_pool
  WHERE session_id = p_session_id AND picked = false
  ORDER BY position
  LIMIT 1
  FOR UPDATE SKIP LOCKED;  -- Critical: Skip already-locked questions

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No questions available',
      'error_code', 'NO_QUESTIONS'
    );
  END IF;

  -- Mark as picked in pool
  UPDATE question_pool SET picked = true WHERE id = v_pool_record.id;

  -- Insert picked question record
  INSERT INTO picked_questions (session_id, guest_id, question_id, round)
  VALUES (p_session_id, p_guest_id, v_pool_record.question_id, p_round);

  -- Update guest status
  UPDATE guests
  SET has_picked = true, picked_question_id = v_pool_record.question_id
  WHERE id = p_guest_id;

  -- Fetch question details for response
  SELECT q.id, q.text, q.topic_id, t.name as topic_name
  INTO v_question_record
  FROM questions q
  JOIN topics t ON q.topic_id = t.id
  WHERE q.id = v_pool_record.question_id;

  RETURN jsonb_build_object(
    'success', true,
    'question', jsonb_build_object(
      'id', v_question_record.id,
      'text', v_question_record.text,
      'topicId', v_question_record.topic_id,
      'topicName', v_question_record.topic_name
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Phase 2: submit_vote_atomic - Prevents duplicate voting
-- ============================================================================
CREATE OR REPLACE FUNCTION submit_vote_atomic(
  p_session_id UUID,
  p_guest_id UUID,
  p_topic_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
  v_topic_id UUID;
BEGIN
  -- Validate guest hasn't already voted
  PERFORM 1 FROM guests WHERE id = p_guest_id AND has_voted = true;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Guest has already voted',
      'error_code', 'ALREADY_VOTED'
    );
  END IF;

  -- Insert all votes atomically
  FOREACH v_topic_id IN ARRAY p_topic_ids
  LOOP
    INSERT INTO votes (session_id, guest_id, topic_id)
    VALUES (p_session_id, p_guest_id, v_topic_id);
  END LOOP;

  -- Update guest status
  UPDATE guests SET has_voted = true WHERE id = p_guest_id;

  RETURN jsonb_build_object(
    'success', true,
    'votes_count', array_length(p_topic_ids, 1)
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Duplicate vote detected',
      'error_code', '23505'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Phase 3: advance_round_atomic - Ensures atomic round advancement with error handling
-- ============================================================================
CREATE OR REPLACE FUNCTION advance_round_atomic(
  p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_current_round INT;
  v_reset_count INT;
BEGIN
  -- Get and lock current round
  SELECT current_round INTO v_current_round
  FROM sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found',
      'error_code', 'SESSION_NOT_FOUND'
    );
  END IF;

  -- Reset all guest pick status
  UPDATE guests
  SET has_picked = false, picked_question_id = null
  WHERE session_id = p_session_id;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  -- Increment round
  UPDATE sessions
  SET current_round = v_current_round + 1
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_round', v_current_round,
    'new_round', v_current_round + 1,
    'guests_reset', v_reset_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Phase 4: end_session_atomic - Ensures session ending and archival happen together
-- ============================================================================
CREATE OR REPLACE FUNCTION end_session_atomic(
  p_session_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_session RECORD;
  v_guests JSONB;
  v_topics JSONB;
  v_questions JSONB;
  v_end_time TIMESTAMPTZ;
BEGIN
  v_end_time := NOW();

  -- Lock and fetch session
  SELECT * INTO v_session
  FROM sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found',
      'error_code', 'SESSION_NOT_FOUND'
    );
  END IF;

  -- Check if already ended
  IF v_session.phase = 'ended' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session already ended',
      'error_code', 'ALREADY_ENDED'
    );
  END IF;

  -- Fetch guests
  SELECT COALESCE(jsonb_agg(row_to_json(g.*)), '[]'::jsonb)
  INTO v_guests
  FROM guests g
  WHERE g.session_id = p_session_id;

  -- Fetch confirmed topics
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'topic_id', st.topic_id,
        'topics', jsonb_build_object('name', t.name)
      )
    ),
    '[]'::jsonb
  )
  INTO v_topics
  FROM session_topics st
  JOIN topics t ON st.topic_id = t.id
  WHERE st.session_id = p_session_id;

  -- Fetch picked questions
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'round', pq.round,
        'guests', jsonb_build_object('nickname', g.nickname),
        'questions', jsonb_build_object(
          'id', q.id,
          'text', q.text,
          'topics', jsonb_build_object('name', t.name)
        )
      )
    ),
    '[]'::jsonb
  )
  INTO v_questions
  FROM picked_questions pq
  JOIN guests g ON pq.guest_id = g.id
  JOIN questions q ON pq.question_id = q.id
  JOIN topics t ON q.topic_id = t.id
  WHERE pq.session_id = p_session_id;

  -- Update session to ended
  UPDATE sessions
  SET phase = 'ended', end_time = v_end_time
  WHERE id = p_session_id;

  -- Archive to session_records
  INSERT INTO session_records (
    id,
    code,
    start_time,
    end_time,
    guest_count,
    guests_json,
    confirmed_topics_json,
    picked_questions_json
  ) VALUES (
    p_session_id,
    v_session.code,
    v_session.start_time,
    v_end_time,
    jsonb_array_length(v_guests),
    v_guests,
    v_topics,
    v_questions
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'guest_count', jsonb_array_length(v_guests),
    'end_time', v_end_time
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Phase 5: confirm_topics_atomic - Ensures topics and question pool are created together
-- ============================================================================
CREATE OR REPLACE FUNCTION confirm_topics_atomic(
  p_session_id UUID,
  p_topic_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
  v_topic_id UUID;
  v_question_record RECORD;
  v_pos INT := 1;
  v_question_count INT := 0;
BEGIN
  -- Insert confirmed topics
  FOREACH v_topic_id IN ARRAY p_topic_ids
  LOOP
    INSERT INTO session_topics (session_id, topic_id)
    VALUES (p_session_id, v_topic_id);
  END LOOP;

  -- Delete existing question pool for this session (if any)
  DELETE FROM question_pool WHERE session_id = p_session_id;

  -- Get all questions from the selected topics and shuffle them
  FOR v_question_record IN (
    SELECT id FROM questions
    WHERE topic_id = ANY(p_topic_ids)
    ORDER BY random()
  ) LOOP
    INSERT INTO question_pool (session_id, question_id, position, picked)
    VALUES (p_session_id, v_question_record.id, v_pos, false);
    v_pos := v_pos + 1;
    v_question_count := v_question_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'topic_count', array_length(p_topic_ids, 1),
    'question_count', v_question_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;
