CREATE TABLE canvases (
  id TEXT PRIMARY KEY NOT NULL,
  write_token_hash TEXT NOT NULL,
  revision INTEGER NOT NULL,
  graph TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
