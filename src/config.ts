import * as dotenv from "dotenv";
dotenv.config();

function must(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Config error: missing env ${name}`);
  return v.trim();
}

export const CONFIG = {
  TELEGRAM_BOT_TOKEN: must("TELEGRAM_BOT_TOKEN"),
  OPENAI_API_KEY: must("OPENAI_API_KEY"),
  ADMIN_IDS: (process.env.BOT_ADMIN_IDS || "")
    .split(",").map(s => s.trim()).filter(Boolean).map(s => Number(s))
    .filter(n => Number.isFinite(n)),
  DEFAULT_LOCALE: process.env.DEFAULT_LOCALE?.trim() || "it",
  CATALOG_BASE_URL: process.env.CATALOG_BASE_URL?.trim() || "https://tessiamo.it",
  DB_PATH: process.env.DB_PATH?.trim() || "data/tessiamo.db",

  // Modelli OpenAI — GPT-4.1 mini (ufficiale)
  // Riferimenti: docs modelli GPT-4.1 / GPT-4.1 mini.
  EMBEDDING_MODEL: "text-embedding-3-small",
  CHAT_MODEL: "gpt-4.1-mini",

  // Memoria
  SUMMARY_EVERY_N_USER_MSGS: 12,
  MAX_MESSAGES_PER_USER: 80,

  // Broadcast (prudenziale rispetto ai limiti Telegram)
  BROADCAST_RPS: 20
};
