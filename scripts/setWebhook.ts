// scripts/setWebhook.ts
import { CONFIG } from "../src/config";
import { Telegraf } from "telegraf";

async function run() {
  const bot = new Telegraf(CONFIG.TELEGRAM_BOT_TOKEN);
  const url = process.env.WEBHOOK_URL || (process.env.WEBHOOK_DOMAIN && `${process.env.WEBHOOK_DOMAIN}${process.env.WEBHOOK_PATH || "/tg/secret"}`);
  if (!url) throw new Error("WEBHOOK_URL or WEBHOOK_DOMAIN not set");
  const full = url.startsWith("http") ? url : `https://${url}`;
  await bot.telegram.setWebhook(full, { drop_pending_updates: true });
  console.log("Webhook set to:", full);
}
run().catch(e => { console.error(e); process.exit(1); });
