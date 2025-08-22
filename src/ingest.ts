import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { putKbItem } from "./db";
import { embedText } from "./rag";

/**
 * Ingestione Markdown in KB (Neon)
 *
 * - Directory di input: --dir=... oppure env KB_DIR, default: data/kb
 * - Front-matter opzionale (YAML) supporta: title, source_url
 * - Chunking opzionale: --chunk (split basato su heading o blocchi ~2000 char)
 */

type CliOpts = { dir: string; chunk: boolean };
function parseArgs(): CliOpts {
  const args = process.argv.slice(2);
  let dir = process.env.KB_DIR || "data/kb";
  let chunk = false;
  for (const a of args) {
    if (a.startsWith("--dir=")) dir = a.slice("--dir=".length);
    if (a === "--chunk") chunk = true;
  }
  return { dir, chunk };
}

function splitIntoChunks(text: string): string[] {
  // 1) prova a splittare per sezioni markdown
  const byH3 = text.split(/\n(?=###\s+)/g);
  if (byH3.length > 1) return byH3;

  // 2) fallback: blocchi ~2000 caratteri
  const size = 2000;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

async function ingestFile(absPath: string, doChunk: boolean) {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data: fm, content } = matter(raw); // front-matter YAML se presente
  const base = path.basename(absPath);
  const inferredTitle = content.split("\n")[0]?.replace(/^#\s*/, "").trim();
  const title = (fm.title as string) || inferredTitle || base.replace(/\.md$/i, "");
  const source_url = (fm.source_url as string) || undefined;

  const chunks = doChunk ? splitIntoChunks(content) : [content];

  // NB: embed per chunk → inseriamo più record kb_items per lo stesso file
  for (const chunk of chunks) {
    const emb = await embedText(chunk);
    await putKbItem({ title, content: chunk, embedding: emb, source_url });
  }
  console.log(`✔ Ingested ${base} (${chunks.length} item${chunks.length > 1 ? "s" : ""})`);
}

async function ingest() {
  const { dir, chunk } = parseArgs();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort();

  if (files.length === 0) {
    console.log(`Nessun .md in ${dir} — aggiungi i file e rilancia.`);
    return;
  }

  for (const f of files) {
    const p = path.join(dir, f);
    await ingestFile(p, chunk);
  }
  console.log("✅ Ingestion KB completata.");
}

ingest().catch((e) => {
  if (e?.code === '42P01' && e?.message?.includes('kb_items')) {
    console.error("❌ Tabella 'kb_items' non trovata. Eseguire prima:");
    console.error("   npm run reset-db -- --recreate");
    console.error("   (oppure creare le tabelle manualmente nel database Neon)");
  } else {
    console.error("❌ Errore ingest:", e);
  }
  process.exit(1);
});
