import OpenAI from "openai";
import { CONFIG } from "./config";
import { buildCatalogLink, LinkParams } from "./linkBuilder";

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

type AdvisorJSON = {
  category: "tessuti" | "pannelli" | "prodotti-sagomati" | "pronto-stampa",
  fantasiePer?: "bambini" | "adulti" | "casa" | "festività",
  soggetto?: "principesse" | "animali" | "floreale" | "sport" | "scuola" | "vintage" | "basic" | "microfantasie",
  reason: string
};

function toLinkParams(j: AdvisorJSON): LinkParams {
  return {
    category: j.category,
    fantasiePer: j.fantasiePer,
    soggetto: j.soggetto,
    page: 1
  };
}

export async function proposeRecommendation(params: {
  recentConversation: {role:'user'|'bot';content:string}[],
  userSummary?: string
}) {
  const convo = params.recentConversation.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

  const system = `Sei un "Consigliere Tessile" per Tessiamo. 
In base a conversazione e preferenze, suggerisci UNA categoria e (opzionalmente) facet per il catalogo.
Devi restituire SOLO JSON valido con il seguente schema (senza testo extra):
{
  "category": "tessuti" | "pannelli" | "prodotti-sagomati" | "pronto-stampa",
  "fantasiePer": "bambini" | "adulti" | "casa" | "festività" | null,
  "soggetto": "principesse" | "animali" | "floreale" | "sport" | "scuola" | "vintage" | "basic" | "microfantasie" | null,
  "reason": "breve motivazione in italiano (max 250 caratteri)"
}
Se non hai abbastanza segnali, scegli "tessuti" e lascia facet null.`;

  const user = `Conversazione recente:\n${convo}\n\nProfilo sintetico (se presente):\n${params.userSummary || "—"}\n\nRestituisci il JSON richiesto.`;

  const out = await openai.chat.completions.create({
    model: CONFIG.CHAT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2
  });

  const raw = out.choices[0]?.message?.content || "{}";
  let parsed: AdvisorJSON;
  try {
    parsed = JSON.parse(raw) as AdvisorJSON;
  } catch {
    parsed = { category: "tessuti", reason: "Suggerimento generico al catalogo principale." };
  }

  const linkParams = toLinkParams(parsed);
  const url = buildCatalogLink(linkParams);
  const text = `Consiglio: ${parsed.reason || "Dai un'occhiata a questi prodotti."}\n${url}`;
  return { text, url, linkParams, parsed };
}
