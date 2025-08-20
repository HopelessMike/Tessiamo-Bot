import fs from "fs";
import path from "path";
import { putKbItem } from "./db";
import { embedText } from "./rag";

async function ingest() {
  const dir = "data/kb";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".md"));
  for (const f of files) {
    const p = path.join(dir, f);
    const txt = fs.readFileSync(p, "utf8");
    const title = txt.split("\n")[0]?.replace(/^#\s*/,"") || f.replace(/\.md$/,"");
    const emb = await embedText(txt);
    putKbItem({ title, content: txt, embedding: emb, source_url: undefined });
    console.log(`Ingested: ${f}`);
  }
  console.log("Done.");
}

ingest().catch(e => { console.error(e); process.exit(1); });
