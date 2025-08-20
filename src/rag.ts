import OpenAI from "openai";
import { CONFIG } from "./config";
import { queryKbByEmbedding } from "./db";

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

export async function embedText(text: string): Promise<number[]> {
  const e = await openai.embeddings.create({
    model: CONFIG.EMBEDDING_MODEL,
    input: text
  });
  return e.data[0].embedding as number[];
}

export async function retrieveContext(query: string) {
  const qEmb = await embedText(query);
  const top = queryKbByEmbedding(qEmb, 5);
  const ctx = top.map(t => `Titolo: ${t.title||"—"}\nFonte: ${t.source_url || "kb interna"}\nContenuto:\n${t.content}`).join("\n\n---\n\n");
  return ctx;
}

export async function answerWithRag(params: {
  userQuery: string,
  userSummary?: string,
  recentConversation?: {role:'user'|'bot';content:string}[]
}) {
  const ctx = await retrieveContext(params.userQuery);
  const system = `Sei "Tessiamo Bot": assistente amichevole e conciso.
- Rispondi solo su tessuti, qualità, usi consigliati, stampa personalizzata e informazioni su Tessiamo.
- Quando possibile, proponi un link al catalogo pertinente (usando i filtri del sito).
- Se la domanda è fuori contesto, rifiuta gentilmente.
- Tono: cordiale, pratico. Lingua: italiana.`;

  const convo = (params.recentConversation||[]).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  const summaryPart = params.userSummary ? `\n\n[Profilo sintetico utente]\n${params.userSummary}\n` : "";

  const prompt = `Contesto knowledge base:\n${ctx}\n${summaryPart}\n[Conversazione recente]\n${convo}\n\n[Domanda utente]\n${params.userQuery}\n\nRisposta:`;

  const chat = await openai.chat.completions.create({
    model: CONFIG.CHAT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ],
    temperature: 0.3
  });

  return chat.choices[0]?.message?.content?.trim() || "Mi dispiace, non ho una risposta al momento.";
}
