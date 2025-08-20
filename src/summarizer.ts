import OpenAI from "openai";
import { CONFIG } from "./config";

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

export async function summarizeConversation(messages: {role:'user'|'bot';content:string}[]): Promise<string> {
  const prompt = `Riassumi in 5-7 frasi la conversazione seguente, annotando:
- scopo del cliente (progetto/uso),
- preferenze (fantasie, basi tessuto, certificazioni),
- eventuali link o categorie citate,
- tono/urgenza.
Stile: sintetico, neutro, orientato all'azione.
Conversazione:\n${messages.map(m=>`${m.role.toUpperCase()}: ${m.content}`).join("\n")}`;
  const out = await openai.chat.completions.create({
    model: CONFIG.CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2
  });
  return out.choices[0]?.message?.content?.trim() || "";
}
