import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await client.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = new Set(
      (await client.query<{ name: string }>("select name from _migrations")).rows.map(
        (r) => r.name
      )
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip (already applied): ${file}`);
        continue;
      }

      console.log(`applying: ${file}`);
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations (name) values ($1)", [file]);
        await client.query("commit");
        console.log(`  ok`);
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }

    console.log("Migrations complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
