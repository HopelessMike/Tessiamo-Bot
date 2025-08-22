import { Telegraf } from "telegraf";
import { listSubscribers } from "./db";
import { CONFIG } from "./config";

export async function runBroadcast(bot: Telegraf, text: string) {
  const subs = await listSubscribers();
  const delayMs = Math.ceil(1000 / CONFIG.BROADCAST_RPS);
  let sent = 0, failed = 0;

  for (let i = 0; i < subs.length; i++) {
    const chatId = subs[i];
    try {
      await bot.telegram.sendMessage(chatId, text, { link_preview_options: { is_disabled: true } });
      sent++;
    } catch (e: any) {
      failed++;
      if (e?.response?.error_code === 429 || /Too Many Requests/i.test(String(e))) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return { sent, failed, total: subs.length };
}
