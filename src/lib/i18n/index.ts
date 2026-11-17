import { ar } from "@/lib/i18n/ar";
import { fr, type Dictionary } from "@/lib/i18n/fr";
import { isLocale, type Locale } from "@/lib/i18n/locales";

export function getDictionary(locale: Locale): Dictionary {
  return locale === "ar" ? ar : fr;
}

export function translateError(locale: Locale, code: string) {
  const dictionary = getDictionary(locale);
  if (code in dictionary.errors) return dictionary.errors[code as keyof typeof dictionary.errors];
  return dictionary.errors.generic;
}

export function statusLabel(
  locale: Locale,
  kind: "confirmation" | "shipment" | "payment",
  status: string,
) {
  const dictionary = getDictionary(locale);
  const group = dictionary.status[kind] as Record<string, string>;
  return group[status] ?? status;
}

export { isLocale };
