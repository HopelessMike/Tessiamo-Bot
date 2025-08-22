-- sql/001_init_neon.sql
-- Schema equivalente a SQLite, con minimi aggiustamenti per Postgres/Neon

CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  username     TEXT,
  first_name   TEXT,
  last_name    TEXT,
  language_code TEXT,
  created_at   BIGINT NOT NULL,  -- epoch ms (per compatibilità col codice esistente)
  last_seen    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','bot')),
  content     TEXT NOT NULL,
  ts          BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_user_ts ON messages(telegram_id, ts);

CREATE TABLE IF NOT EXISTS summaries (
  telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  summary     TEXT   NOT NULL,
  updated_at  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS kb_items (
  id         BIGSERIAL PRIMARY KEY,
  source_url TEXT,
  title      TEXT,
  content    TEXT   NOT NULL,
  embedding  JSONB  NOT NULL,    -- era TEXT JSON-serializzato su SQLite
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_updated ON kb_items(updated_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  since       BIGINT NOT NULL
);
