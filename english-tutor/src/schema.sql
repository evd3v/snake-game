CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('word','pv','expr')),
  headword TEXT NOT NULL,
  pos TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT '',
  source_json TEXT NOT NULL,
  group_key TEXT,
  group_label TEXT,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','shown','discussing','learning','known','suspended')),
  explanation_md TEXT,
  shown_at TEXT,
  decided_at TEXT,
  fsrs_due TEXT,
  fsrs_stability REAL NOT NULL DEFAULT 0,
  fsrs_difficulty REAL NOT NULL DEFAULT 0,
  fsrs_elapsed_days INTEGER NOT NULL DEFAULT 0,
  fsrs_scheduled_days INTEGER NOT NULL DEFAULT 0,
  fsrs_reps INTEGER NOT NULL DEFAULT 0,
  fsrs_lapses INTEGER NOT NULL DEFAULT 0,
  fsrs_learning_steps INTEGER NOT NULL DEFAULT 0,
  fsrs_state INTEGER NOT NULL DEFAULT 0,
  fsrs_last_review TEXT,
  known_at TEXT,
  stream TEXT NOT NULL DEFAULT 'main',
  topic TEXT,
  freq_rank INTEGER,
  UNIQUE (kind, headword, pos)
);
CREATE INDEX IF NOT EXISTS cards_status_order ON cards(status, order_index);
CREATE INDEX IF NOT EXISTS cards_due ON cards(status, fsrs_due);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  type TEXT NOT NULL CHECK (type IN ('context','cloze')),
  sentence TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS tests_card_unused ON tests(card_id, used_at);

CREATE TABLE IF NOT EXISTS review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  ts TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  test_id INTEGER REFERENCES tests(id),
  test_type TEXT,
  sentence TEXT,
  answer TEXT,
  scheduled_days INTEGER,
  due_after TEXT
);
CREATE INDEX IF NOT EXISTS review_log_card ON review_log(card_id, id);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  ts TEXT NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
