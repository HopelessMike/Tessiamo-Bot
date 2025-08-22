import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import OpenAI from "openai";
import { CONFIG } from "./config";
import { Telegraf } from "telegraf";

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

async function downloadToTemp(url: string, prefix = "tg-voice", ext = ".ogg"): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const file = path.join(tmp, `audio${ext}`);
  fs.writeFileSync(file, buf);
  return file;
}

async function transcribeLocalWhisper(filePath: string): Promise<string> {
  // richiede: Python, ffmpeg e pacchetto openai-whisper installato (CLI `whisper`)
  // crea output .txt nella stessa directory
  return await new Promise<string>((resolve, reject) => {
    const args = [
      filePath,
      "--language", "it",
      "--model", CONFIG.WHISPER_CLI_MODEL,
      "--task", "transcribe",
      "--fp16", "False",
      "--temperature", "0",
      "--output_format", "txt",
      "--no_speech_threshold", "0.6",
      "--output_dir", path.dirname(filePath)
    ];
    const p = spawn("whisper", args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`whisper exited with ${code}`));
      const txt = filePath.replace(path.extname(filePath), ".txt");
      try {
        const out = fs.readFileSync(txt, "utf8").trim();
        resolve(out);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function transcribeOpenAI(filePath: string): Promise<string> {
  const file = fs.createReadStream(filePath);
  const t = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1", // fallback API
    language: "it"
  });
  return t.text.trim();
}

export async function transcribeTelegramVoice(bot: Telegraf, fileId: string): Promise<string> {
  const link = await bot.telegram.getFileLink(fileId);
  const local = await downloadToTemp(link.href, "tg-voice", ".ogg");
  try {
    if (CONFIG.VOICE_ENGINE === "local") {
      return await transcribeLocalWhisper(local);
    } else {
      return await transcribeOpenAI(local);
    }
  } finally {
    // pulizia best-effort
    try { fs.rmSync(path.dirname(local), { recursive: true, force: true }); } catch {}
  }
}
