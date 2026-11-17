import fs from "node:fs";
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (name) => env.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const site = get("NEXT_PUBLIC_SITE_URL");
console.log(JSON.stringify({
  urlOk: url === "https://bujpnspelubnnqfcuoae.supabase.co",
  siteOk: site === "http://localhost:3010",
  anonSet: get("NEXT_PUBLIC_SUPABASE_ANON_KEY").length > 20,
  serviceSet: get("SUPABASE_SERVICE_ROLE_KEY").length > 20,
  tokenSet: get("SCENO_SETUP_TOKEN").length > 20,
  serviceIsPublic: get("SUPABASE_SERVICE_ROLE_KEY").startsWith("sb_publishable") || env.includes("NEXT_PUBLIC_SUPABASE_SERVICE"),
}));
