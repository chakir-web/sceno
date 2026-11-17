import "server-only";
import { cookies } from "next/headers";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { getSettings } from "@/lib/services/settings";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const chosen = jar.get("sceno_locale")?.value;
  if (isLocale(chosen)) return chosen;
  const settings = await getSettings();
  if (settings.data?.defaultLocale === "ar") return "ar";
  return "fr";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, dict: getDictionary(locale) };
}
