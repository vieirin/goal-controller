-- Create table for storing model variables
CREATE TABLE IF NOT EXISTS model_variables (
  model_hash TEXT PRIMARY KEY,
  variables TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

