import { Telegraf } from "telegraf";
import { CONFIG } from "./config";
import { upsertUser, addMessage, getUserMessageCountSinceLastSummary, getRecentConversation, upsertSummary, subscribe, getSummary } from "./db";
import { answerWithRag } from "./rag";
import { summarizeConversation } from "./summarizer";
import { runBroadcast } from "./broadcast";
import { proposeRecommendation } from "./advisor";
import { catalogoMessage } from "./catalogLinks";
import { transcribeTelegramVoice } from "./voice";

export function createBot() {
  const bot = new Telegraf(CONFIG.TELEGRAM_BOT_TOKEN);

  // Messaggio di benvenuto (copy aggiornato)
  bot.start(async (ctx) => {
    const u = ctx.from!;
    await upsertUser({
      id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name,
      language_code: u.language_code
    });
    await subscribe(u.id);

    const welcome =
`🎨 Ciao, sono *Ale di Tessiamo*!  
Il tuo consulente tessile: ti aiuto a scegliere il tessuto giusto, capire gli usi migliori e trovare subito i prodotti che cerchi.

👉 Cosa puoi chiedermi:
• “Che tessuto consigli per tovaglie resistenti?”  
• “Avete pannelli con principesse per bambini?”  
• “Quali basi sono adatte alla stampa?”  

💬 Scrivimi *oppure inviami un vocale*: lo trascrivo e ti rispondo al volo.  
📚 Se vuoi esplorare da solo:
${catalogoMessage()}`;

    await ctx.reply(welcome, { parse_mode: "Markdown" });
  });

  bot.help(async (ctx) => {
    const txt =
`Posso aiutarti con:
• Consigli su basi tessuto e usi
• Link reali al catalogo (solo link ufficiali dalla nostra KB)
• Info su stampa personalizzata
• Novità e promozioni (quando disponibili)

Comandi: /catalogo /consiglio /promo`;
    await ctx.reply(txt);
  });

  // /catalogo — solo testo con link (niente bottoni)
  bot.command("catalogo", async (ctx) => {
    await ctx.reply(catalogoMessage(), { parse_mode: "Markdown" });
  });

  // /promo
  bot.command("promo", async (ctx) => {
    await ctx.reply("🎉 Al momento non ci sono promozioni attive. Continua a seguirci qui: annunceremo qui le prossime offerte!");
  });

  // /consiglio — analizza chat/summary e propone un link *canonico* dalla mappa
  bot.command("consiglio", async (ctx) => {
    const u = ctx.from!;
    const conv = await getRecentConversation(u.id, 40);
    const summary = await getSummary(u.id);
    const { text } = await proposeRecommendation({ recentConversation: conv, userSummary: summary || undefined });
    await addMessage(u.id, "bot", text);
    await ctx.reply(text, { parse_mode: "Markdown" });
  });

  // Admin: /broadcast <testo>
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

  // Handler TESTO (senza “prelink” automatico, niente bottoni)
  bot.on("text", async (ctx) => {
    const u = ctx.from!;
    const text = ctx.message.text.trim();

    await upsertUser({
      id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name,
      language_code: u.language_code
    });
    await addMessage(u.id, "user", text);

    const recent = await getRecentConversation(u.id, 14);
    const summary = await getSummary(u.id);
    const answer = await answerWithRag({
      userQuery: text,
      userSummary: summary || undefined,
      recentConversation: recent
    });

    await addMessage(u.id, "bot", answer);
    await ctx.reply(answer, { parse_mode: "Markdown" });

    const c = await getUserMessageCountSinceLastSummary(u.id);
    if (c >= CONFIG.SUMMARY_EVERY_N_USER_MSGS) {
      const conv = await getRecentConversation(u.id, 40);
      const s = await summarizeConversation(conv);
      await upsertSummary(u.id, s);
    }
  });

  // Handler VOCE (Whisper open-source -> testo -> stesso flusso del testo)
  bot.on("voice", async (ctx) => {
    const u = ctx.from!;
    const voice = ctx.message.voice;
    if (!voice) return;

    try {
      const transcript = await transcribeTelegramVoice(bot, voice.file_id);
      // Log utente (come testo)
      await upsertUser({
        id: u.id, username: u.username, first_name: u.first_name, last_name: u.last_name,
        language_code: u.language_code
      });
      await addMessage(u.id, "user", `[VOCale] ${transcript}`);

      const recent = await getRecentConversation(u.id, 14);
      const summary = await getSummary(u.id);
      const answer = await answerWithRag({
        userQuery: transcript,
        userSummary: summary || undefined,
        recentConversation: recent
      });

      await addMessage(u.id, "bot", answer);
      await ctx.reply(answer, { parse_mode: "Markdown" });

      const c = await getUserMessageCountSinceLastSummary(u.id);
      if (c >= CONFIG.SUMMARY_EVERY_N_USER_MSGS) {
        const convForSummary = await getRecentConversation(u.id, 40);
        const s = await summarizeConversation(convForSummary);
        await upsertSummary(u.id, s);
      }
    } catch (e:any) {
      console.error("Errore trascrizione:", e);
      await ctx.reply("Non riesco a sentire bene il vocale 😅. Puoi riprovare o scrivermi in chat?");
    }
  });

  return bot;
}
