CREATE TABLE IF NOT EXISTS ai_rate_limits (
  visitor_hash TEXT NOT NULL,
  hour_bucket INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (visitor_hash, hour_bucket)
);
