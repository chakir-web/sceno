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
const functions = await client.query("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1");
const products = await client.query("select count(*)::int as n from public.products");
const policies = await client.query("select count(*)::int as n from pg_policies where schemaname = 'public'");
console.log("functions", functions.rows.map((row) => row.proname).join(","));
console.log("products", products.rows[0].n, "policies", policies.rows[0].n);
const rates = await client.query("select count(*)::int as n from public.shipping_rates");
console.log("rates", rates.rows[0].n);
const variant = await client.query("select id, product_id from public.product_variants limit 1");
console.log("variant", variant.rows[0].product_id, variant.rows[0].id);
await client.end();
