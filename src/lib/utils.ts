import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "@/lib/i18n/locales";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amount: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value: string | Date, locale: Locale, withTime = true) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    dateStyle: "medium",
    timeStyle: withTime ? "short" : undefined,
    timeZone: "Africa/Casablanca",
  }).format(date);
}

export function formatNumber(amount: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number | null, locale: Locale) {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
