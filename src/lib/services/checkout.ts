import { errorCode, isMissingSchema } from "@/lib/errors";
import { asNumber } from "@/lib/http";
import type { Locale } from "@/lib/i18n/locales";
import { lineTotal, orderTotal, resolveShippingFee, unitPrice, type ShippingRate as FeeRate } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { listRates, getSettings } from "@/lib/services/settings";

export type QuoteLine = {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  variantLabel: string;
  quantity: number;
  unitPriceMad: number;
  lineTotalMad: number;
  stockQuantity: number;
};

export type Quote = {
  lines: QuoteLine[];
  subtotalMad: number;
  shippingFeeMad: number;
  totalMad: number;
  currency: "MAD";
};

type QuoteItem = { productId: string; variantId: string; quantity: number };

export async function quoteOrder(input: { city: string; locale: Locale; items: QuoteItem[] }) {
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, code: "not_configured" };

  const variantIds = Array.from(new Set(input.items.map((item) => item.variantId)));
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, product_id, sku, size, color, price_mad, stock_quantity, is_active, products (id, price_mad, promo_price_mad, is_active, product_translations (locale, name))",
    )
    .in("id", variantIds);

  if (error) return { ok: false as const, code: isMissingSchema(error) ? "not_configured" : errorCode(error) };

  const rows = new Map((data ?? []).map((row) => [row.id as string, row]));
  const merged = new Map<string, QuoteItem>();
  for (const item of input.items) {
    const key = `${item.productId}:${item.variantId}`;
    const current = merged.get(key);
    merged.set(key, { ...item, quantity: (current?.quantity ?? 0) + item.quantity });
  }

  const lines: QuoteLine[] = [];
  for (const item of merged.values()) {
    if (item.quantity < 1 || item.quantity > 20) return { ok: false as const, code: "invalid_items" };
    const row = rows.get(item.variantId) as
      | {
          id: string;
          product_id: string;
          sku: string;
          size: string | null;
          color: string | null;
          price_mad: number | string | null;
          stock_quantity: number;
          is_active: boolean;
          products:
            | {
                id: string;
                price_mad: number | string;
                promo_price_mad: number | string | null;
                is_active: boolean;
                product_translations?: { locale: string; name: string }[] | null;
              }
            | {
                id: string;
                price_mad: number | string;
                promo_price_mad: number | string | null;
                is_active: boolean;
                product_translations?: { locale: string; name: string }[] | null;
              }[]
            | null;
        }
      | undefined;
    const product = Array.isArray(row?.products) ? row?.products[0] : row?.products;
    if (!row || !product || row.product_id !== item.productId || !row.is_active || !product.is_active) {
      return { ok: false as const, code: "product_unavailable" };
    }
    if (row.stock_quantity < item.quantity) return { ok: false as const, code: "insufficient_stock" };
    const translations = product.product_translations ?? [];
    const name =
      translations.find((translation) => translation.locale === input.locale)?.name ??
      translations.find((translation) => translation.locale === "fr")?.name ??
      row.id;
    const price = unitPrice(asNumber(product.price_mad), product.promo_price_mad == null ? null : asNumber(product.promo_price_mad), row.price_mad == null ? null : asNumber(row.price_mad));
    lines.push({
      productId: item.productId,
      variantId: item.variantId,
      sku: row.sku,
      name,
      variantLabel: [row.size, row.color].filter(Boolean).join(" / "),
      quantity: item.quantity,
      unitPriceMad: price,
      lineTotalMad: lineTotal(price, item.quantity),
      stockQuantity: row.stock_quantity,
    });
  }

  const [settings, rates] = await Promise.all([getSettings(), listRates(false)]);
  const feeRates: FeeRate[] = rates.data.map((rate) => ({ city: rate.city, feeMad: rate.feeMad, isActive: rate.isActive }));
  const shippingFeeMad = resolveShippingFee(input.city, feeRates, settings.data?.defaultShippingFeeMad ?? 0);
  const subtotalMad = lines.reduce((sum, line) => sum + line.lineTotalMad, 0);
  const quote: Quote = {
    lines,
    subtotalMad,
    shippingFeeMad,
    totalMad: orderTotal(subtotalMad, shippingFeeMad),
    currency: "MAD",
  };
  return { ok: true as const, quote };
}

export async function placeOrder(input: {
  fullName: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  locale: Locale;
  idempotencyKey: string;
  items: QuoteItem[];
}) {
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, code: "not_configured" };
  const { data, error } = await supabase.rpc("create_order", {
    payload: {
      full_name: input.fullName,
      phone: input.phone,
      city: input.city,
      address: input.address,
      notes: input.notes,
      locale: input.locale,
      idempotency_key: input.idempotencyKey,
      items: input.items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
    },
  });
  if (error) return { ok: false as const, code: isMissingSchema(error) ? "not_configured" : errorCode(error) };
  const order = data as {
    order_id: string;
    order_number: string;
    subtotal_mad: number;
    shipping_fee_mad: number;
    total_mad: number;
    replayed: boolean;
  };
  return { ok: true as const, order };
}

export async function trackOrder(orderNumber: string, phone: string) {
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, code: "not_configured" };
  const { data, error } = await supabase.rpc("track_order", {
    p_order_number: orderNumber,
    p_phone: phone,
  });
  if (error) return { ok: false as const, code: isMissingSchema(error) ? "not_configured" : errorCode(error) };
  return { ok: true as const, order: data as Record<string, unknown> };
}
