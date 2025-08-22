import OpenAI from "openai";
import { CONFIG } from "./config";
import { getCanonicalLink } from "./catalogLinks";

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

type AdvisorJSON = {
  // categoria macro obbligatoria
  category: "tessuti" | "pannelli" | "prodotti-sagomati" | "pronto-stampa",
  // (facoltativo) sotto-categoria tra quelle che abbiamo linkate
  subCategory?: "bavaglini" | "shopper",
  reason: string
};

export async function proposeRecommendation(params: {
  recentConversation: {role:'user'|'bot';content:string}[],
  userSummary?: string
}) {
  const convo = params.recentConversation.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  const system = `Sei un "Consigliere Tessile" per Tessiamo.
In base a conversazione e preferenze, scegli UNA categoria macro tra: tessuti, pannelli, prodotti-sagomati, pronto-stampa.
Se pertinente, indica UNA subCategory tra: bavaglini, shopper.
Rispondi SOLO con JSON valido:
{"category": "...", "subCategory": "...", "reason": "max 250 caratteri in italiano"}
Se non hai segnali chiari, scegli "tessuti" e ometti subCategory.`;
  const user = `Conversazione recente:\n${convo}\n\nProfilo sintetico:\n${params.userSummary || "—"}\n\nRitorna il JSON.`;

  const out = await openai.chat.completions.create({
    model: CONFIG.CHAT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2
  });

  let parsed: AdvisorJSON = { category: "tessuti", reason: "Dai un’occhiata ai tessuti al metro: è la scelta più versatile." };
  try {
    parsed = JSON.parse(out.choices[0]?.message?.content || "{}") as AdvisorJSON;
  } catch { /* fallback di default già impostato */ }

  const link = getCanonicalLink(parsed.subCategory || parsed.category) || getCanonicalLink(parsed.category) || getCanonicalLink("tessuti")!;
  const text = `Consiglio: ${parsed.reason}\n${link}`;
  return { text, url: link, parsed };
}
