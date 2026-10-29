CREATE TABLE IF NOT EXISTS quiz_files (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quiz_files(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('open', 'mcq')),
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_index INTEGER
);

CREATE TABLE IF NOT EXISTS quiz_submissions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quiz_files(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_mcq INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS quiz_questions_order ON quiz_questions(quiz_id, position);
CREATE INDEX IF NOT EXISTS quiz_submissions_order ON quiz_submissions(quiz_id, created_at);
