import fs from "node:fs";
import pg from "pg";

const ref = "bujpnspelubnnqfcuoae";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const password = env.match(/^SUPABASE_DB_PASSWORD=(.*)$/m)?.[1]?.trim();
const client = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const admins = await client.query("select count(*)::int as n from public.profiles where role = 'admin'");
const users = await client.query("select count(*)::int as n from auth.users");
const rls = await client.query("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity");
console.log("admins", admins.rows[0].n);
console.log("users", users.rows[0].n);
console.log("tables_without_rls", rls.rows.map((row) => row.relname).join(",") || "none");
await client.end();
