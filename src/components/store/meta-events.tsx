"use client";

import { useEffect } from "react";
import { useProductColor } from "@/components/store/product-color";
import { trackViewItem } from "@/lib/analytics/ga";
import { metaFunnelEventId } from "@/lib/meta/event-id";
import { getMetaProductData, variantForSelection } from "@/lib/meta/product";
import { reportMeta, trackMeta } from "@/lib/meta/pixel";
import { catalogContentId, tiktokCommerce } from "@/lib/tiktok/commerce";
import { reportTikTok } from "@/lib/tiktok/pixel";
import { unitPrice } from "@/lib/pricing";
import type { CatalogProduct } from "@/types/commerce";

export function ProductView({ product }: { product: CatalogProduct }) {
  const selection = useProductColor();
  const variant = variantForSelection(product.variants, { variantId: selection?.variantId, color: selection?.color });
  const value = unitPrice(product.priceMad, product.promoPriceMad, variant?.priceMad ?? null);
  const contentId = catalogContentId(product, variant);

  useEffect(() => {
    const meta = getMetaProductData(product, { variantSku: variant?.sku, quantity: 1, unitPrice: value });
    if (meta) reportMeta("ViewContent", meta, metaFunnelEventId("ViewContent"));
    trackViewItem({
      id: contentId,
      name: product.name,
      category: product.categoryName ?? undefined,
      price: value,
      quantity: 1,
    }, value);
    reportTikTok("ViewContent", tiktokCommerce([{ id: contentId, name: product.name, quantity: 1, price: value }], value, product.categoryName ?? undefined), crypto.randomUUID());
  }, [contentId, product, variant?.sku, value]);

  return null;
}

export function SearchView({ query }: { query?: string }) {
  useEffect(() => {
    const search = query?.trim();
    if (!search) return;
    trackMeta("Search", { search_string: search });
  }, [query]);
  return null;
}
