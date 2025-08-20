import { createBot } from "./bot";
import { db } from "./db";

async function main() {
  // inizializza DB
  db.pragma('user_version');

  const bot = createBot();

  // imposta comandi visibili in Telegram
  await bot.telegram.setMyCommands([
    { command: "start", description: "Avvia il bot" },
    { command: "help", description: "Come posso aiutarti" },
    { command: "catalogo", description: "Link al catalogo prodotti" },
    { command: "consiglio", description: "Suggerimento personalizzato + link" },
    { command: "promo", description: "Promozioni attive" }
  ]);

  console.log("Starting Tessiamo bot (long-polling)...");
  await bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
