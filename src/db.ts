import Database from "better-sqlite3";
import { CONFIG } from "./config";

export const db = new Database(CONFIG.DB_PATH);

// DDL
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  role TEXT CHECK(role IN ('user','bot')) NOT NULL,
  content TEXT NOT NULL,
  ts INTEGER NOT NULL,
  FOREIGN KEY(telegram_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_user_ts ON messages(telegram_id, ts);

CREATE TABLE IF NOT EXISTS summaries (
  telegram_id INTEGER PRIMARY KEY,
  summary TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kb_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT,
  title TEXT,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_updated ON kb_items(updated_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  telegram_id INTEGER PRIMARY KEY,
  since INTEGER NOT NULL
);
`);

export function upsertUser(u: {
  id: number; username?: string; first_name?: string; last_name?: string; language_code?: string;
}) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO users (telegram_id, username, first_name, last_name, language_code, created_at, last_seen)
    VALUES (@id, @username, @first_name, @last_name, @language_code, @now, @now)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username=excluded.username,
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      language_code=excluded.language_code,
      last_seen=excluded.created_at
  `).run({ ...u, now });
}

export function addMessage(telegram_id: number, role: 'user'|'bot', content: string) {
  db.prepare(`INSERT INTO messages (telegram_id, role, content, ts) VALUES (?, ?, ?, ?)`)
    .run(telegram_id, role, content, Date.now());
  const row = db.prepare(`SELECT COUNT(*) AS c FROM messages WHERE telegram_id=?`).get(telegram_id) as { c: number };
  const count = row.c || 0;
  if (count > CONFIG.MAX_MESSAGES_PER_USER) {
    db.prepare(`
      DELETE FROM messages WHERE id IN (
        SELECT id FROM messages WHERE telegram_id=?
        ORDER BY ts ASC LIMIT ?
      )
    `).run(telegram_id, count - CONFIG.MAX_MESSAGES_PER_USER);
  }
}

export function getUserMessageCountSinceLastSummary(telegram_id: number): number {
  const sum = db.prepare(`SELECT updated_at FROM summaries WHERE telegram_id=?`).get(telegram_id) as {updated_at:number}|undefined;
  const since = sum?.updated_at || 0;
  const row = db.prepare(`
    SELECT COUNT(*) AS c FROM messages WHERE telegram_id=? AND role='user' AND ts>?`).get(telegram_id, since) as {c:number};
  return row.c || 0;
}

export function getRecentConversation(telegram_id: number, limit = 16) {
  return db.prepare(`
    SELECT role, content FROM messages
    WHERE telegram_id=?
    ORDER BY ts DESC LIMIT ?
  `).all(telegram_id, limit).reverse() as {role:'user'|'bot';content:string}[];
}

export function getSummary(telegram_id: number): string | undefined {
  const row = db.prepare(`SELECT summary FROM summaries WHERE telegram_id=?`).get(telegram_id) as {summary?:string}|undefined;
  return row?.summary;
}

export function upsertSummary(telegram_id: number, summary: string) {
  db.prepare(`
    INSERT INTO summaries (telegram_id, summary, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET summary=excluded.summary, updated_at=excluded.updated_at
  `).run(telegram_id, summary, Date.now());
}

export function putKbItem(rec: {source_url?:string; title?:string; content:string; embedding:number[]}) {
  db.prepare(`
    INSERT INTO kb_items (source_url, title, content, embedding, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(rec.source_url||null, rec.title||null, rec.content, JSON.stringify(rec.embedding), Date.now());
}

type KbRow = { id:number; source_url: string|null; title: string|null; content: string; embedding: string };

export function queryKbByEmbedding(queryEmbedding: number[], k = 5) {
  const rows = db.prepare(`SELECT id, source_url, title, content, embedding FROM kb_items`).all() as KbRow[];
  function cosine(a:number[], b:number[]) { 
    let dot=0, na=0, nb=0;
    for (let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    return dot / (Math.sqrt(na)*Math.sqrt(nb) + 1e-8);
  }
  const scored = rows.map(r => ({
    id: r.id, source_url: r.source_url || undefined, title: r.title || undefined, content: r.content,
    score: cosine(queryEmbedding, JSON.parse(r.embedding) as number[])
  })).sort((a,b)=>b.score-a.score).slice(0,k);
  return scored;
}

export function subscribe(telegram_id:number) {
  db.prepare(`INSERT OR IGNORE INTO subscriptions (telegram_id, since) VALUES (?, ?)`).run(telegram_id, Date.now());
}

export function listSubscribers(): number[] {
  const rows = db.prepare(`SELECT telegram_id FROM subscriptions`).all() as { telegram_id: number }[];
  return rows.map((row) => row.telegram_id);
}
