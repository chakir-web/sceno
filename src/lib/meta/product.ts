import { colorKey } from "@/lib/catalog/images";
import { roundMoney } from "@/lib/pricing";

export type MetaItem = { id: string; quantity: number; item_price?: number };

export type MetaCommerce = {
  content_ids: string[];
  content_type: "product";
  contents: MetaItem[];
  num_items: number;
  currency: "MAD";
  value?: number;
  content_name?: string;
  content_category?: string;
};

function text(value: string | null | undefined, max: number) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, max) : "";
}

function quantityOf(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 1;
  return Math.min(20, Math.round(value));
}

function priceOf(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return roundMoney(value);
}

export function variantForSelection<T extends { id: string; isActive: boolean; color?: string | null }>(
  variants: T[],
  selection?: { variantId?: string | null; color?: string | null },
) {
  const active = variants.filter((item) => item.isActive);
  const byId = selection?.variantId ? active.find((item) => item.id === selection.variantId) : undefined;
  if (byId) return byId;
  const byColor = active.find((item) => colorKey(item.color) === colorKey(selection?.color));
  return byColor ?? active[0];
}

/** Identifiant catalogue : SKU variante, puis SKU produit, puis id Supabase. */
export function metaContentId(product: { id: string; sku?: string | null }, variantSku?: string | null) {
  return text(variantSku, 80) || text(product.sku, 80) || text(product.id, 80);
}

export function getMetaProductData(
  product: { id: string; sku?: string | null; name?: string | null; categoryName?: string | null },
  options?: { variantSku?: string | null; quantity?: number; unitPrice?: number },
): MetaCommerce | null {
  const id = metaContentId(product, options?.variantSku);
  if (!id) return null;
  const quantity = quantityOf(options?.quantity);
  const unitPrice = priceOf(options?.unitPrice);
  const name = text(product.name, 160);
  const category = text(product.categoryName, 120);
  return {
    content_ids: [id],
    content_type: "product",
    contents: [{ id, quantity, ...(unitPrice !== undefined ? { item_price: unitPrice } : {}) }],
    num_items: quantity,
    currency: "MAD",
    ...(unitPrice !== undefined ? { value: roundMoney(unitPrice * quantity) } : {}),
    ...(name ? { content_name: name } : {}),
    ...(category ? { content_category: category } : {}),
  };
}

export function getMetaCartData(
  lines: Array<{ id: string; sku?: string | null; quantity: number; unitPrice?: number }>,
  value?: number,
): MetaCommerce | null {
  const contents: MetaItem[] = [];
  for (const line of lines) {
    const id = metaContentId({ id: line.id, sku: line.sku });
    if (!id) continue;
    const quantity = quantityOf(line.quantity);
    const unitPrice = priceOf(line.unitPrice);
    contents.push({ id, quantity, ...(unitPrice !== undefined ? { item_price: unitPrice } : {}) });
  }
  if (!contents.length) return null;
  const total = priceOf(value);
  return {
    content_ids: contents.map((item) => item.id),
    content_type: "product",
    contents,
    num_items: contents.reduce((sum, item) => sum + item.quantity, 0),
    currency: "MAD",
    ...(total !== undefined ? { value: total } : {}),
  };
}

/** Paramètres Pixel d'un Purchase. La devise reste le code ISO MAD, jamais un symbole. */
export function purchasePixelData(meta: MetaCommerce, value: number) {
  const amount = priceOf(value);
  return {
    content_ids: meta.content_ids,
    content_type: "product" as const,
    contents: meta.contents.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      ...(item.item_price !== undefined ? { item_price: item.item_price } : {}),
    })),
    num_items: meta.num_items,
    currency: "MAD" as const,
    ...(amount !== undefined ? { value: amount } : {}),
  };
}
