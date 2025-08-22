// index.ts
import express, { Request, Response, NextFunction } from "express";
import { createBot } from "./bot"; // <-- il tuo file esistente: non toccarlo
import { CONFIG } from "./config";
import crypto from "crypto";

/**
 * Avvio in 2 modalità:
 * - PROD webhook: se WEBHOOK_URL o WEBHOOK_DOMAIN sono definiti
 * - DEV polling:  se NON sono definiti => bot.launch()
 */

async function main() {
  // eventuale init schema (se vuoi eseguire DDL minimi all'avvio):
  // await db.exec(`CREATE TABLE IF NOT EXISTS ... ;`);

  const bot = createBot();

  await bot.telegram.setMyCommands([
    { command: "start", description: "Avvia il bot" },
    { command: "help", description: "Come posso aiutarti" },
  ]);

  const PORT = CONFIG.PORT;

  // Path segreto: se non definito, generiamo dai primi 24 char dell’HMAC del token
  const path =
    CONFIG.WEBHOOK_PATH ||
    `/tg/${crypto
      .createHash("sha256")
      .update(CONFIG.TELEGRAM_BOT_TOKEN)
      .digest("base64url")
      .slice(0, 24)}`;

  // URL completo
  const url =
    CONFIG.WEBHOOK_URL ||
    (CONFIG.WEBHOOK_DOMAIN ? `https://${CONFIG.WEBHOOK_DOMAIN}${path}` : undefined);

  const USE_WEBHOOK = Boolean(url);

  if (USE_WEBHOOK) {
    const app = express();
    app.use(express.json());

    // health check
    app.get("/health", (_req: Request, res: Response) => res.status(200).send("ok"));

    // (Opzionale) valida il Secret Token di Telegram se lo hai impostato
    const callback = bot.webhookCallback(path);
    app.post(path, (req: Request, res: Response, next: NextFunction) => {
      const secret = CONFIG.WEBHOOK_SECRET;
      if (secret) {
        const header = req.header("X-Telegram-Bot-Api-Secret-Token");
        if (header !== secret) {
          return res.status(401).send("unauthorized");
        }
      }
      return callback(req, res, next);
    });

    // Registra/aggiorna webhook
    await bot.telegram.setWebhook(url!, {
      drop_pending_updates: true,
      secret_token: CONFIG.WEBHOOK_SECRET,
    });

    app.listen(PORT, () => {
      console.log(`✅ Webhook online: ${url}  (porta ${PORT}, path ${path})`);
    });

    process.once("SIGINT", () => process.exit(0));
    process.once("SIGTERM", () => process.exit(0));
  } else {
    // DEV fallback: polling
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    console.log("▶️  Avvio in long-polling (DEV)...");
    await bot.launch();
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
