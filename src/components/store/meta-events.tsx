"use client";

import { useEffect } from "react";
import { useProductColor } from "@/components/store/product-color";
import { colorKey } from "@/lib/catalog/images";
import { trackViewItem } from "@/lib/analytics/ga";
import { metaFunnelEventId } from "@/lib/meta/event-id";
import { reportMeta, trackMeta } from "@/lib/meta/pixel";
import { catalogContentId, tiktokCommerce } from "@/lib/tiktok/commerce";
import { reportTikTok } from "@/lib/tiktok/pixel";
import { unitPrice } from "@/lib/pricing";
import type { CatalogProduct } from "@/types/commerce";

export function ProductView({ product }: { product: CatalogProduct }) {
  const selected = useProductColor()?.color ?? null;
  const variant = product.variants.find((item) => item.isActive && colorKey(item.color) === colorKey(selected))
    ?? product.variants.find((item) => item.isActive);
  const value = unitPrice(product.priceMad, product.promoPriceMad, variant?.priceMad ?? null);
  const contentId = catalogContentId(product, variant);

  useEffect(() => {
    reportMeta("ViewContent", {
      content_ids: [product.id],
      content_type: "product",
      content_name: product.name,
      content_category: product.categoryName ?? undefined,
      value,
      currency: "MAD",
      num_items: 1,
      contents: [{ id: product.id, quantity: 1, item_price: value }],
    }, metaFunnelEventId("ViewContent"));
    trackViewItem({
      id: contentId,
      name: product.name,
      category: product.categoryName ?? undefined,
      price: value,
      quantity: 1,
    }, value);
    reportTikTok("ViewContent", tiktokCommerce([{ id: contentId, name: product.name, quantity: 1, price: value }], value, product.categoryName ?? undefined), crypto.randomUUID());
  }, [contentId, product.id, product.name, product.categoryName, value]);

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
