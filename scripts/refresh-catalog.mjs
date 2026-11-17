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
const images = [
  ["30000000-0000-4000-8000-000000000001", "/catalog/lampe.jpg"],
  ["30000000-0000-4000-8000-000000000002", "/catalog/vase.jpg"],
  ["30000000-0000-4000-8000-000000000003", "/catalog/linge.jpg"],
  ["30000000-0000-4000-8000-000000000004", "/catalog/bougie.jpg"],
  ["30000000-0000-4000-8000-000000000005", "/catalog/plateau.jpg"],
  ["30000000-0000-4000-8000-000000000006", "/catalog/coussin.jpg"],
];
for (const [id, url] of images) {
  await client.query("update public.product_images set url = $1 where id = $2", [url, id]);
}
await client.query("update public.categories set image_url = '/catalog/lampe.jpg' where slug = 'luminaires'");
await client.query("update public.categories set image_url = '/catalog/vase.jpg' where slug = 'ceramique'");
await client.query("update public.categories set image_url = '/catalog/linge.jpg' where slug = 'textile'");
await client.query("update public.categories set image_url = '/catalog/bougie.jpg' where slug = 'parfum-dinterieur'");
await client.query("update public.product_translations set description = replace(description, ' Pièce de démonstration.', ''), short_description = short_description where locale = 'fr'");
await client.query("update public.product_translations set description = replace(description, ' قطعة للعرض.', '') where locale = 'ar'");
await client.query("update public.store_settings set about_fr = $1, about_ar = $2", [
  "SCENO est une maison d'objets pour le Maroc. Chaque pièce est choisie pour sa matière, sa ligne et sa tenue dans le temps.",
  "SCENO دار أشياء للمغرب. كل قطعة مختارة لمادتها وخطها وثباتها مع الوقت.",
]);
const rows = await client.query("select url from public.product_images order by sort_order, url");
console.log(rows.rows.map((row) => row.url).join(","));
await client.end();
