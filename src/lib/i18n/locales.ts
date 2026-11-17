export const locales = ["fr", "ar"] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "fr" || value === "ar";
}

export function direction(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
