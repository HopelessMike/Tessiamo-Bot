import { Telegraf, Markup } from "telegraf";
import { CONFIG } from "./config";
import { upsertUser, addMessage, getUserMessageCountSinceLastSummary, getRecentConversation, upsertSummary, subscribe, getSummary } from "./db";
import { answerWithRag } from "./rag";
import { isOnTopic } from "./classifier";
import { summarizeConversation } from "./summarizer";
import { buildCatalogLink, inferLink } from "./linkBuilder";
import { runBroadcast } from "./broadcast";
import { proposeRecommendation } from "./advisor";

export function createBot() {
  const bot = new Telegraf(CONFIG.TELEGRAM_BOT_TOKEN);

  bot.start(async (ctx) => {
    const u = ctx.from!;
    upsertUser({
      id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name,
      language_code: u.language_code
    });
    subscribe(u.id);

    const kbBtn = Markup.inlineKeyboard([
      [Markup.button.url("Tessuti al metro", buildCatalogLink({ category: "tessuti", page: 1 }))],
      [Markup.button.url("Pannelli in tessuto", buildCatalogLink({ category: "pannelli", page: 1 }))],
      [Markup.button.url("Prodotti sagomati", buildCatalogLink({ category: "prodotti-sagomati", page: 1 }))],
      [Markup.button.url("Pronto stampa (basi)", buildCatalogLink({ category: "pronto-stampa", page: 1 }))]
    ]);

    await ctx.reply(
      "Ciao! 👋 Sono il bot di Tessiamo. Posso aiutarti a scegliere il tessuto giusto, consigliare gli usi migliori e darti link diretti al catalogo.\n" +
      "Scrivimi pure cosa stai cercando (es. \"pannelli principesse per bambini\", \"tessuto per tovaglie\").",
      kbBtn
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply("📌 Posso aiutarti con:\n• Consigli su basi tessuto e usi\n• Link al catalogo con filtri\n• Info su stampa personalizzata\n• Promozioni e novità\nComandi: /catalogo /consiglio /promo");
  });

  bot.command("catalogo", async (ctx) => {
    const kb = Markup.inlineKeyboard([
      [Markup.button.url("Tessuti al metro", buildCatalogLink({ category: "tessuti", page: 1 }))],
      [Markup.button.url("Pannelli in tessuto", buildCatalogLink({ category: "pannelli", page: 1 }))],
      [Markup.button.url("Prodotti sagomati", buildCatalogLink({ category: "prodotti-sagomati", page: 1 }))],
      [Markup.button.url("Pronto stampa (basi)", buildCatalogLink({ category: "pronto-stampa", page: 1 }))]
    ]);
    await ctx.reply("Ecco il nostro catalogo 👇", kb);
  });

  bot.command("promo", async (ctx) => {
    await ctx.reply("🎉 Al momento non ci sono promozioni attive. Continua a seguirci qui: annunceremo qui le prossime offerte!");
  });

  bot.command("consiglio", async (ctx) => {
    const u = ctx.from!;
    const conv = getRecentConversation(u.id, 40);
    const summary = getSummary(u.id);
    const { text } = await proposeRecommendation({ recentConversation: conv, userSummary: summary });
    addMessage(u.id, "bot", text);
    await ctx.reply(text, { link_preview_options: { is_disabled: false } });
  });

  bot.command("broadcast", async (ctx) => {
    if (!CONFIG.ADMIN_IDS.includes(ctx.from?.id || 0)) {
      return ctx.reply("❌ Comando riservato allo staff Tessiamo.");
    }
    const text = ctx.message?.text?.replace(/^\/broadcast(@\S+)?\s*/i, "")?.trim();
    if (!text) return ctx.reply("Uso: /broadcast <messaggio>");
    await ctx.reply("Invio in corso (rispettiamo i limiti di Telegram)...");
    const res = await runBroadcast(bot, text);
    await ctx.reply(`✅ Broadcast completato: inviati ${res.sent}/${res.total} (falliti: ${res.failed}).`);
  });

  bot.on("text", async (ctx) => {
    const u = ctx.from!;
    const text = ctx.message.text.trim();

    upsertUser({
      id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name,
      language_code: u.language_code
    });
    addMessage(u.id, "user", text);

    const onTopic = await isOnTopic(text);
    if (!onTopic) {
      const msg = "Capisco la curiosità 😊 ma posso aiutarti solo su tessuti, stampa personalizzata e prodotti Tessiamo. Vuoi un consiglio per il tuo progetto o un link al catalogo?";
      addMessage(u.id, "bot", msg);
      return ctx.reply(msg);
    }

    const inferred = inferLink(text);
    if (inferred) {
      const url = buildCatalogLink(inferred);
      await ctx.reply(`Potrebbe interessarti dare un'occhiata qui:\n${url}`, { link_preview_options: { is_disabled: false } });
    }

    const recent = getRecentConversation(u.id, 14);
    const summary = getSummary(u.id);
    const answer = await answerWithRag({
      userQuery: text,
      userSummary: summary,
      recentConversation: recent
    });

    addMessage(u.id, "bot", answer);
    await ctx.reply(answer, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Tessuti per Bambini", url: buildCatalogLink({ category: "tessuti", fantasiePer: "bambini" }) }],
          [{ text: "Pannelli Principesse", url: buildCatalogLink({ category: "pannelli", fantasiePer: "bambini", soggetto: "principesse" }) }]
        ]
      }
    });

    const c = getUserMessageCountSinceLastSummary(u.id);
    if (c >= CONFIG.SUMMARY_EVERY_N_USER_MSGS) {
      const conv = getRecentConversation(u.id, 40);
      const s = await summarizeConversation(conv);
      upsertSummary(u.id, s);
    }
  });

  return bot;
}
