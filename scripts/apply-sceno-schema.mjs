import fs from "node:fs";
import pg from "pg";

const SCENO_REF = "bujpnspelubnnqfcuoae";
const FORBIDDEN = new Set(["cbzoqigbdlkbcgbhzdwb"]);
if (FORBIDDEN.has(SCENO_REF)) {
  console.error("refused");
  process.exit(1);
}

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const password = env.match(/^SUPABASE_DB_PASSWORD=(.*)$/m)?.[1]?.trim();
if (!password) {
  console.error("missing-password");
  process.exit(1);
}

const hosts = [
  `postgresql://postgres.${SCENO_REF}:${encodeURIComponent(password)}@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${SCENO_REF}:${encodeURIComponent(password)}@aws-1-eu-west-3.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres:${encodeURIComponent(password)}@db.${SCENO_REF}.supabase.co:5432/postgres`,
];

async function connect() {
  let last = "no-attempt";
  for (const connectionString of hosts) {
    const host = connectionString.split("@")[1];
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    try {
      await client.connect();
      console.log("connected", host);
      return client;
    } catch (error) {
      last = `${host} ${error instanceof Error ? error.message : "error"}`;
      console.log("failed", last);
      await client.end().catch(() => {});
    }
  }
  throw new Error(last);
}

function splitSql(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  let dollar = null;
  let quote = false;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (!dollar && !quote && rest.startsWith("--")) {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? sql.length : nl + 1;
      current += sql.slice(i, end);
      i = end;
      continue;
    }
    if (!dollar && sql[i] === "'") {
      if (quote && sql[i + 1] === "'") {
        current += "''";
        i += 2;
        continue;
      }
      quote = !quote;
      current += "'";
      i += 1;
      continue;
    }
    if (!quote) {
      const tag = rest.match(/^\$[A-Za-z0-9_]*\$/);
      if (tag) {
        if (!dollar) dollar = tag[0];
        else if (dollar === tag[0]) dollar = null;
        current += tag[0];
        i += tag[0].length;
        continue;
      }
    }
    if (!dollar && !quote && sql[i] === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      i += 1;
      continue;
    }
    current += sql[i];
    i += 1;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function applyFile(path) {
  const sql = fs.readFileSync(path, "utf8");
  const statements = splitSql(sql);
  console.log("statements", statements.length, path);
  for (let index = 0; index < statements.length; index += 1) {
    try {
      await client.query(statements[index]);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (["42P07", "42710", "42723", "23505"].includes(code)) {
        console.log("skip", index, code);
        continue;
      }
      const message = error instanceof Error ? error.message : "error";
      console.error("failed-statement", index, statements[index].length, message);
      throw error;
    }
  }
}

const client = await connect();
const identity = await client.query("select current_database() as db");
console.log("database", identity.rows[0].db);

await applyFile(new URL("../supabase/migrations/20261116120000_init.sql", import.meta.url));
await applyFile(new URL("../supabase/migrations/20261116123000_audit_helper.sql", import.meta.url));
console.log("migrations-checked");

const seeded = await client.query("select count(*)::int as n from public.products");
if (seeded.rows[0].n === 0) {
  const seed = fs.readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
  await client.query(seed);
  console.log("seed-applied");
} else {
  console.log("products", seeded.rows[0].n);
}

const tables = await client.query(`
  select c.relname as name, c.relrowsecurity as rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by 1
`);
console.log(tables.rows.map((row) => `${row.name}:${row.rls}`).join(","));
await client.end();
