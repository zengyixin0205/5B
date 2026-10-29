CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL DEFAULT 'Student',
  answer_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS answers_question_created
  ON answers(question_id, created_at);
