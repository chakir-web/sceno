import type { Locale } from "@/lib/i18n/locales";
import { formatMoney } from "@/lib/utils";

export function StorePrice({ amount, compare, locale, size = "md" }: { amount: number; compare?: number | null; locale: Locale; size?: "md" | "lg" }) {
  const scale = size === "lg" ? "px-4 py-2 text-4xl" : "px-2 py-1 text-sm";
  const compareScale = size === "lg" ? "text-xl" : "text-xs";
  const previous = compare != null && compare > amount ? compare : null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={`inline-flex border-2 border-office-success font-semibold leading-none text-office-success ${scale}`}>{formatMoney(amount, locale, 0)}</span>
      {previous != null ? <span className={`font-semibold leading-none text-office-danger line-through ${compareScale}`}>{formatMoney(previous, locale, 0)}</span> : null}
    </p>
  );
}
