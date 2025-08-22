import OpenAI from "openai";
import { CONFIG } from "./config";
import { searchKb } from "./db";

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
  const top = await searchKb(qEmb, 6);
  const ctx = top.map((t: any) => `Titolo: ${t.title||"—"}\nFonte: ${t.source_url || "kb interna"}\nContenuto:\n${t.content}`).join("\n\n---\n\n");
  return ctx;
}

export async function answerWithRag(params: {
  userQuery: string,
  userSummary?: string,
  recentConversation?: {role:'user'|'bot';content:string}[]
}) {
  const ctx = await retrieveContext(params.userQuery);
  const system = `Sei "Ale di Tessiamo": un* consulente tessile amichevole, chiaro e pratico.
  - Rispondi solo su tessuti, qualità, usi consigliati, stampa personalizzata e informazioni su Tessiamo.
  - IMPORTANTISSIMO: quando suggerisci link, usa esclusivamente i link presenti nel contesto KB. Non inventare e non comporre URL con parametri. Se nel contesto non c’è un link adeguato, invita ad aprire /catalogo.
  - Adatta il tono al livello dell’utente: semplice per chi è alle prime armi, più tecnico per professionisti.
  - Se la domanda è fuori contesto, rifiuta gentilmente spiegando che puoi aiutare solo su temi legati a Tessiamo.
  - Lingua: italiana. Firma le risposte con lo stile di “Ale” (caldo, diretto, costruttivo).`;


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

  return chat.choices[0]?.message?.content?.trim() || "Mi dispiace, al momento non ho una risposta precisa—posso mostrarti il catalogo?";
}
