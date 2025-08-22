// db.ts (versione Neon/Postgres)
import { Pool, PoolClient } from "pg";
import { CONFIG } from "./config";

export const pool = new Pool({
  connectionString: CONFIG.DATABASE_URL, // es: NEON_DATABASE_URL
  max: CONFIG.PGPOOL_MAX,
  ssl: { rejectUnauthorized: false },    // Neon richiede SSL
});

// Set search path per usare lo schema bot_schema per tutte le connessioni
pool.on('connect', async (client) => {
  try {
    await client.query('SET search_path TO bot_schema, public');
  } catch (e) {
    console.warn('Warning: Could not set search_path to bot_schema');
  }
});

type SQLParams = any[];

// ------------------------
// Helpers
// ------------------------
async function q(sql: string, params?: SQLParams, client?: PoolClient) {
  const runner = client || pool;
  return runner.query(sql, params);
}

function nowMs() {
  return Date.now();
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] || 0, y = b[i] || 0;
    dot += x * y; na += x * x; nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ------------------------
// Users
// ------------------------
export async function upsertUser(u: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
}) {
  const now = nowMs();
  await q(
    `
    INSERT INTO users (telegram_id, username, first_name, last_name, language_code, created_at, last_seen)
    VALUES ($1, $2, $3, $4, $5, $6, $6)
    ON CONFLICT (telegram_id) DO UPDATE SET
      username=EXCLUDED.username,
      first_name=EXCLUDED.first_name,
      last_name=EXCLUDED.last_name,
      language_code=EXCLUDED.language_code,
      last_seen=EXCLUDED.last_seen
    `,
    [u.id, u.username ?? null, u.first_name ?? null, u.last_name ?? null, u.language_code ?? null, now]
  );
}

// ------------------------
// Messages
// ------------------------
export async function addMessage(
  telegram_id: number,
  role: "user" | "bot",
  content: string,
  ts: number = nowMs()
) {
  await q(
    `INSERT INTO messages (telegram_id, role, content, ts) VALUES ($1, $2, $3, $4)`,
    [telegram_id, role, content, ts]
  );
}

export async function countMessagesForUser(telegram_id: number): Promise<number> {
  const r = await q(
    `SELECT COUNT(*)::text AS c FROM messages WHERE telegram_id=$1`,
    [telegram_id]
  );
  return Number(r.rows[0]?.c || 0);
}

export async function deleteOldestMessages(telegram_id: number, limit: number) {
  await q(
    `
    DELETE FROM messages
    WHERE id IN (
      SELECT id FROM messages
      WHERE telegram_id=$1
      ORDER BY ts ASC
      LIMIT $2
    )
    `,
    [telegram_id, limit]
  );
}

export async function getRecentMessages(
  telegram_id: number,
  limit: number
): Promise<Array<{ role: "user" | "bot"; content: string }>> {
  const r = await q(
    `SELECT role, content FROM messages WHERE telegram_id=$1 ORDER BY ts DESC LIMIT $2`,
    [telegram_id, limit]
  );
  return r.rows;
}

export async function countUserMessagesSince(telegram_id: number, sinceTs: number): Promise<number> {
  const r = await q(
    `SELECT COUNT(*)::text AS c FROM messages WHERE telegram_id=$1 AND role='user' AND ts>$2`,
    [telegram_id, sinceTs]
  );
  return Number(r.rows[0]?.c || 0);
}

// ------------------------
// Summaries
// ------------------------
export async function getSummary(telegram_id: number): Promise<string | null> {
  const r = await q(
    `SELECT summary FROM summaries WHERE telegram_id=$1`,
    [telegram_id]
  );
  return r.rows[0]?.summary ?? null;
}

export async function getSummaryUpdatedAt(telegram_id: number): Promise<number | null> {
  const r = await q(
    `SELECT updated_at::text AS updated_at FROM summaries WHERE telegram_id=$1`,
    [telegram_id]
  );
  return r.rows.length ? Number(r.rows[0].updated_at) : null;
}

export async function upsertSummary(telegram_id: number, summary: string) {
  const now = nowMs();
  await q(
    `
    INSERT INTO summaries (telegram_id, summary, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (telegram_id) DO UPDATE
      SET summary=EXCLUDED.summary, updated_at=EXCLUDED.updated_at
    `,
    [telegram_id, summary, now]
  );
}

// ------------------------
// Knowledge base (KB)
// ------------------------
export async function putKbItem(rec: {
  source_url?: string;
  title?: string;
  content: string;
  embedding: number[];
}) {
  await q(
    `
    INSERT INTO kb_items (source_url, title, content, embedding, updated_at)
    VALUES ($1, $2, $3, $4::jsonb, $5)
    `,
    [rec.source_url ?? null, rec.title ?? null, rec.content, JSON.stringify(rec.embedding), nowMs()]
  );
}

type KbRow = {
  id: number;
  source_url: string | null;
  title: string | null;
  content: string;
  embedding: any; // jsonb
};

export async function searchKb(queryEmbedding: number[], k: number): Promise<
  Array<{
    id: number;
    source_url?: string;
    title?: string;
    content: string;
    score: number;
  }>
> {
  // Piccolo dataset: calcolo in memoria
  const r = await q(`SELECT id, source_url, title, content, embedding FROM kb_items`);
  const scored = r.rows.map((row: any) => {
    const emb = Array.isArray(row.embedding)
      ? (row.embedding as number[])
      : typeof row.embedding === "string"
        ? (JSON.parse(row.embedding) as number[])
        : (row.embedding as number[]);
    return {
      id: row.id,
      source_url: row.source_url || undefined,
      title: row.title || undefined,
      content: row.content,
      score: cosine(queryEmbedding, emb),
    };
  });
  scored.sort((a: any, b: any) => b.score - a.score);
  return scored.slice(0, k);
}

// ------------------------
// Subscriptions (broadcast)
// ------------------------
export async function subscribe(telegram_id: number) {
  await q(
    `INSERT INTO subscriptions (telegram_id, since) VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO NOTHING`,
    [telegram_id, nowMs()]
  );
}

export async function listSubscribers(): Promise<number[]> {
  const r = await q(`SELECT telegram_id::text FROM subscriptions`);
  return r.rows.map((row: any) => Number(row.telegram_id));
}

// Missing functions needed by bot.ts
export async function getUserMessageCountSinceLastSummary(telegram_id: number): Promise<number> {
  const lastSummaryTs = await getSummaryUpdatedAt(telegram_id);
  if (!lastSummaryTs) {
    return await countMessagesForUser(telegram_id);
  }
  return await countUserMessagesSince(telegram_id, lastSummaryTs);
}

export async function getRecentConversation(
  telegram_id: number,
  limit: number
): Promise<Array<{ role: "user" | "bot"; content: string }>> {
  const messages = await getRecentMessages(telegram_id, limit);
  return messages.reverse(); // Return in chronological order
}

// ------------------------
// Shutdown pulito
// ------------------------
process.once("SIGINT", () => pool.end());
process.once("SIGTERM", () => pool.end());
