-- The Shared Table - Initial Database Schema
-- Migration: 001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Topics table
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('lobby', 'voting', 'topicResults', 'topicReveal', 'questionPhase', 'ended')),
  current_round INT DEFAULT 1,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guests table
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  has_voted BOOLEAN DEFAULT FALSE,
  has_picked BOOLEAN DEFAULT FALSE,
  picked_question_id UUID REFERENCES questions(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, nickname)
);

-- Votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, guest_id, topic_id)
);

-- Session topics (confirmed topics for a session)
CREATE TABLE session_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, topic_id)
);

-- Question pool (shuffled questions for a session)
CREATE TABLE question_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  position INT NOT NULL,
  picked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Picked questions
CREATE TABLE picked_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  round INT NOT NULL,
  picked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session records (archived completed sessions)
CREATE TABLE session_records (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  guest_count INT NOT NULL,
  guests_json JSONB NOT NULL,
  confirmed_topics_json JSONB NOT NULL,
  picked_questions_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_questions_topic_id ON questions(topic_id);
CREATE INDEX idx_guests_session_id ON guests(session_id);
CREATE INDEX idx_votes_session_id ON votes(session_id);
CREATE INDEX idx_votes_guest_id ON votes(guest_id);
CREATE INDEX idx_votes_topic_id ON votes(topic_id);
CREATE INDEX idx_session_topics_session_id ON session_topics(session_id);
CREATE INDEX idx_question_pool_session_id ON question_pool(session_id);
CREATE INDEX idx_question_pool_position ON question_pool(session_id, position);
CREATE INDEX idx_picked_questions_session_id ON picked_questions(session_id);
CREATE INDEX idx_sessions_code ON sessions(code);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE picked_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_records ENABLE ROW LEVEL SECURITY;

-- Topics: Public read, admin-only write
CREATE POLICY "Anyone can read topics" ON topics
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert topics" ON topics
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update topics" ON topics
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete topics" ON topics
  FOR DELETE USING (auth.role() = 'authenticated');

-- Questions: Public read, admin-only write
CREATE POLICY "Anyone can read questions" ON questions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert questions" ON questions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update questions" ON questions
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete questions" ON questions
  FOR DELETE USING (auth.role() = 'authenticated');

-- Sessions: Anyone can read/write during active sessions
CREATE POLICY "Anyone can read sessions" ON sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert sessions" ON sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update sessions" ON sessions
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete sessions" ON sessions
  FOR DELETE USING (true);

-- Guests: Anyone can read/write
CREATE POLICY "Anyone can read guests" ON guests
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert guests" ON guests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update guests" ON guests
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete guests" ON guests
  FOR DELETE USING (true);

-- Votes: Anyone can read/write
CREATE POLICY "Anyone can read votes" ON votes
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert votes" ON votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update votes" ON votes
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete votes" ON votes
  FOR DELETE USING (true);

-- Session topics: Anyone can read/write
CREATE POLICY "Anyone can read session_topics" ON session_topics
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert session_topics" ON session_topics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update session_topics" ON session_topics
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete session_topics" ON session_topics
  FOR DELETE USING (true);

-- Question pool: Anyone can read/write
CREATE POLICY "Anyone can read question_pool" ON question_pool
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert question_pool" ON question_pool
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update question_pool" ON question_pool
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete question_pool" ON question_pool
  FOR DELETE USING (true);

-- Picked questions: Anyone can read/write
CREATE POLICY "Anyone can read picked_questions" ON picked_questions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert picked_questions" ON picked_questions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update picked_questions" ON picked_questions
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete picked_questions" ON picked_questions
  FOR DELETE USING (true);

-- Session records: Admin-only
CREATE POLICY "Authenticated users can access session_records" ON session_records
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Generate unique session code
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..5 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM sessions WHERE code = result) INTO code_exists;

    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Populate question pool from confirmed topics
CREATE OR REPLACE FUNCTION populate_question_pool(session_uuid UUID, topic_uuids UUID[])
RETURNS VOID AS $$
DECLARE
  shuffled_questions UUID[];
  question_record RECORD;
  pos INT := 1;
BEGIN
  -- Delete existing question pool for this session
  DELETE FROM question_pool WHERE session_id = session_uuid;

  -- Get all questions from the selected topics and shuffle them
  FOR question_record IN (
    SELECT id FROM questions
    WHERE topic_id = ANY(topic_uuids)
    ORDER BY random()
  ) LOOP
    INSERT INTO question_pool (session_id, question_id, position, picked)
    VALUES (session_uuid, question_record.id, pos, false);
    pos := pos + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default topics
INSERT INTO topics (name) VALUES
  ('Family'),
  ('Dreams & Ambitions'),
  ('Childhood Memories'),
  ('Travel & Adventure'),
  ('Food & Culture'),
  ('Love & Relationships'),
  ('Life Lessons'),
  ('Fears & Courage');

-- Insert default questions (we'll need to get the topic IDs first)
DO $$
DECLARE
  family_id UUID;
  dreams_id UUID;
  childhood_id UUID;
  travel_id UUID;
  food_id UUID;
  love_id UUID;
  lessons_id UUID;
  fears_id UUID;
BEGIN
  -- Get topic IDs
  SELECT id INTO family_id FROM topics WHERE name = 'Family';
  SELECT id INTO dreams_id FROM topics WHERE name = 'Dreams & Ambitions';
  SELECT id INTO childhood_id FROM topics WHERE name = 'Childhood Memories';
  SELECT id INTO travel_id FROM topics WHERE name = 'Travel & Adventure';
  SELECT id INTO food_id FROM topics WHERE name = 'Food & Culture';
  SELECT id INTO love_id FROM topics WHERE name = 'Love & Relationships';
  SELECT id INTO lessons_id FROM topics WHERE name = 'Life Lessons';
  SELECT id INTO fears_id FROM topics WHERE name = 'Fears & Courage';

  -- Insert questions for Family
  INSERT INTO questions (topic_id, text) VALUES
    (family_id, 'What family tradition means the most to you?'),
    (family_id, 'Who in your family do you admire most and why?'),
    (family_id, 'What''s a lesson you learned from your parents or guardians?'),
    (family_id, 'Describe your favorite family gathering or celebration.');

  -- Insert questions for Dreams & Ambitions
  INSERT INTO questions (topic_id, text) VALUES
    (dreams_id, 'What''s one dream you''ve always had but haven''t pursued yet?'),
    (dreams_id, 'If you could master any skill instantly, what would it be?'),
    (dreams_id, 'Where do you see yourself in 10 years?'),
    (dreams_id, 'What accomplishment are you most proud of?');

  -- Insert questions for Childhood Memories
  INSERT INTO questions (topic_id, text) VALUES
    (childhood_id, 'What''s your earliest childhood memory?'),
    (childhood_id, 'What game or activity did you love as a child?'),
    (childhood_id, 'Who was your childhood hero?'),
    (childhood_id, 'Describe a moment from your childhood that shaped who you are today.');

  -- Insert questions for Travel & Adventure
  INSERT INTO questions (topic_id, text) VALUES
    (travel_id, 'What''s the most memorable place you''ve ever visited?'),
    (travel_id, 'If you could live anywhere in the world for a year, where would it be?'),
    (travel_id, 'What''s the most adventurous thing you''ve ever done?'),
    (travel_id, 'Describe a travel experience that changed your perspective.');

  -- Insert questions for Food & Culture
  INSERT INTO questions (topic_id, text) VALUES
    (food_id, 'What''s your favorite comfort food and why?'),
    (food_id, 'What dish reminds you of home?'),
    (food_id, 'If you could only eat one cuisine for the rest of your life, what would it be?'),
    (food_id, 'What''s a food-related memory that makes you smile?');

  -- Insert questions for Love & Relationships
  INSERT INTO questions (topic_id, text) VALUES
    (love_id, 'What does love mean to you?'),
    (love_id, 'Who has had the biggest impact on your life and why?'),
    (love_id, 'What''s the best advice you''ve received about relationships?'),
    (love_id, 'Describe a moment when you felt truly connected to someone.');

  -- Insert questions for Life Lessons
  INSERT INTO questions (topic_id, text) VALUES
    (lessons_id, 'What''s the most important lesson you''ve learned in life?'),
    (lessons_id, 'What advice would you give your younger self?'),
    (lessons_id, 'What mistake taught you the most?'),
    (lessons_id, 'What wisdom have you gained from a difficult experience?');

  -- Insert questions for Fears & Courage
  INSERT INTO questions (topic_id, text) VALUES
    (fears_id, 'What''s something you''re afraid of but want to overcome?'),
    (fears_id, 'Describe a time when you had to be brave.'),
    (fears_id, 'What gives you courage when you''re facing something difficult?'),
    (fears_id, 'What fear have you already conquered?');
END $$;
