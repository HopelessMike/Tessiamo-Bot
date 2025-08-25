// config.ts (aggiornato)
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

function must(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Config error: missing env ${name}`);
  return v.trim();
}

export const CONFIG = {
  // obbligatori
  TELEGRAM_BOT_TOKEN: must("TELEGRAM_BOT_TOKEN"),
  OPENAI_API_KEY: must("OPENAI_API_KEY"),

  // amministratori (facoltativo, come nel tuo file)
  ADMIN_IDS: (process.env.BOT_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n)),

  // -------------------------
  // AGGIUNTE per webhook
  // -------------------------
  PORT: Number(process.env.PORT || 3000),
  WEBHOOK_URL: process.env.WEBHOOK_URL?.trim(),
  WEBHOOK_DOMAIN: process.env.WEBHOOK_DOMAIN?.trim(),
  WEBHOOK_PATH: process.env.WEBHOOK_PATH?.trim(),
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET?.trim(),

  // -------------------------
  // AGGIUNTE per Neon/Postgres
  // -------------------------
  // Usa preferibilmente NEON_DATABASE_URL; in alternativa DATABASE_URL
  DATABASE_URL:
    process.env.NEON_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "",
  PGPOOL_MAX: Number(process.env.PGPOOL_MAX || 5),

  // Legacy (se altre parti del progetto leggono ancora DB_PATH, lascialo pure)
  DB_PATH: process.env.DB_PATH?.trim() || "data/bot.sqlite",

  // -------------------------
  // Il resto dei tuoi parametri (metto default sicuri)
  // -------------------------
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
  CHAT_MODEL: process.env.CHAT_MODEL?.trim() || "gpt-4.1-mini",

  SUMMARY_EVERY_N_USER_MSGS: Number(process.env.SUMMARY_EVERY_N_USER_MSGS || 12),
  MAX_MESSAGES_PER_USER: Number(process.env.MAX_MESSAGES_PER_USER || 80),

  BROADCAST_RPS: Number(process.env.BROADCAST_RPS || 20),

  VOICE_ENGINE: (process.env.VOICE_ENGINE?.trim() || "local") as "local" | "openai",
  WHISPER_CLI_MODEL: process.env.WHISPER_CLI_MODEL?.trim() || "small", // base|small|medium...
  
  // Catalog base URL
  CATALOG_BASE_URL: process.env.CATALOG_BASE_URL?.trim() || "https://tessiamo.it",
};
