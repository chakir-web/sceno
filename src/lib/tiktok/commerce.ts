export type TikTokLine = {
  id: string;
  name?: string;
  quantity?: number;
  price?: number;
};

export type TikTokContent = {
  content_id: string;
  content_name?: string;
  quantity: number;
  price?: number;
};

export type TikTokCommerce = {
  contents: TikTokContent[];
  content_id: string;
  content_ids: string[];
  content_type: "product";
  content_category?: string;
  quantity: number;
  num_items: number;
  value?: number;
  currency: "MAD";
};

export function catalogContentId(product: { id: string; sku?: string | null }, variant?: { sku?: string | null } | null) {
  return variant?.sku?.trim() || product.sku?.trim() || product.id;
}

export function tiktokCommerce(lines: TikTokLine[], value?: number, category?: string): TikTokCommerce | null {
  const contents: TikTokContent[] = [];
  for (const line of lines) {
    const content_id = line.id.trim();
    if (!content_id) continue;
    const quantity = Number.isFinite(line.quantity) && (line.quantity ?? 0) > 0 ? Math.min(20, Math.round(line.quantity as number)) : 1;
    const price = typeof line.price === "number" && Number.isFinite(line.price) ? Math.round(line.price * 100) / 100 : undefined;
    const name = line.name?.trim().slice(0, 160);
    contents.push({
      content_id,
      ...(name ? { content_name: name } : {}),
      quantity,
      ...(price !== undefined ? { price } : {}),
    });
  }
  if (!contents.length) return null;

  const content_ids = contents.map((item) => item.content_id);
  const quantity = contents.reduce((sum, item) => sum + item.quantity, 0);
  const rounded = typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
  const content_category = category?.trim().slice(0, 120);

  return {
    contents,
    content_id: content_ids[0],
    content_ids,
    content_type: "product",
    ...(content_category ? { content_category } : {}),
    quantity,
    num_items: quantity,
    ...(rounded !== undefined ? { value: rounded } : {}),
    currency: "MAD",
  };
}
