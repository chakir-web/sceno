"use client";

import { useEffect } from "react";
import { useProductColor } from "@/components/store/product-color";
import { colorKey } from "@/lib/catalog/images";
import { trackMeta } from "@/lib/meta/pixel";
import { unitPrice } from "@/lib/pricing";
import type { CatalogProduct } from "@/types/commerce";

export function ProductView({ product }: { product: CatalogProduct }) {
  const selected = useProductColor()?.color ?? null;
  const variant = product.variants.find((item) => item.isActive && colorKey(item.color) === colorKey(selected))
    ?? product.variants.find((item) => item.isActive);
  const value = unitPrice(product.priceMad, product.promoPriceMad, variant?.priceMad ?? null);

  useEffect(() => {
    trackMeta("ViewContent", {
      content_ids: [product.id],
      content_type: "product",
      content_name: product.name,
      content_category: product.categoryName ?? undefined,
      value,
      currency: "MAD",
      contents: [{ id: product.id, quantity: 1, item_price: value }],
    });
  }, [product.id, product.name, product.categoryName, selected, value]);

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
