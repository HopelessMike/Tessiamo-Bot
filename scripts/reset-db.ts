import * as dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import fs from "fs";
import path from "path";

// ENV: usa NEON_DATABASE_URL/DATABASE_URL come nel config.ts
const DATABASE_URL =
  process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!DATABASE_URL) {
  console.error("Missing NEON_DATABASE_URL/DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function arg(flag: string) {
  return process.argv.includes(flag);
}

/**
 * Modalità:
 *  --only-kb     : TRUNCATE kb_items
 *  --only-data   : TRUNCATE users, messages, summaries, subscriptions
 *  --all         : TRUNCATE TUTTO (kb + dati)
 *  --recreate    : DROP + ricrea schema da sql/001_init_neon.sql
 *
 * Esempi:
 *  npx tsx reset-db.ts --only-kb
 *  npx tsx reset-db.ts --only-data
 *  npx tsx reset-db.ts --all
 *  npx tsx reset-db.ts --recreate
 */
async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (arg("--recreate")) {
      console.log("Creo schema (senza drop per permessi)…");
      const schemaPath = path.join(process.cwd(), "sql", "001_init_neon.sql");
      const sql = fs.readFileSync(schemaPath, "utf8");
      await client.query(sql);
      console.log("✅ Schema creato.");
      await client.query("COMMIT");
      return;
    }

    const onlyKb = arg("--only-kb");
    const onlyData = arg("--only-data");
    const all = arg("--all") || (!onlyKb && !onlyData); // default: all

    if (onlyKb) {
      await client.query(`TRUNCATE TABLE kb_items RESTART IDENTITY;`);
      console.log("✅ Pulita KB (kb_items).");
    } else if (onlyData) {
      await client.query(`
        TRUNCATE TABLE messages, summaries, subscriptions, users RESTART IDENTITY CASCADE;
      `);
      console.log("✅ Puliti dati utenti/conversazioni.");
    } else if (all) {
      await client.query(`
        TRUNCATE TABLE messages, summaries, subscriptions, kb_items, users RESTART IDENTITY CASCADE;
      `);
      console.log("✅ Pulito tutto (KB + dati).");
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
