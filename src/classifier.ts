import OpenAI from "openai";
import { CONFIG } from "./config";

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

export async function isOnTopic(text: string): Promise<boolean> {
  const prompt = `Classifica se la seguente richiesta è ATTINENTE al dominio "tessuti, stampa su tessuto, qualità, usi consigliati, prodotti venduti da Tessiamo, catalogo Tessiamo".
Rispondi solo con "ON" (attinente) oppure "OFF" (non attinente).
Testo: """${text}"""`;
  const out = await openai.chat.completions.create({
    model: CONFIG.CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });
  const t = (out.choices[0]?.message?.content || "").toUpperCase();
  return t.includes("ON");
}
