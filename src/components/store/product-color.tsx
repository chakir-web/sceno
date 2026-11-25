"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { CatalogProduct } from "@/types/commerce";

type ProductSelection = {
  color: string | null;
  variantId: string | null;
  setColor: (color: string | null) => void;
  setVariantId: (variantId: string | null) => void;
};

const ProductColorContext = createContext<ProductSelection | null>(null);

export function ProductColorProvider({ product, children }: { product: CatalogProduct; children: React.ReactNode }) {
  const initial = product.variants.find((variant) => variant.isActive);
  const [color, setColor] = useState(initial?.color ?? null);
  const [variantId, setVariantId] = useState(initial?.id ?? null);
  const value = useMemo(() => ({ color, variantId, setColor, setVariantId }), [color, variantId]);
  return <ProductColorContext.Provider value={value}>{children}</ProductColorContext.Provider>;
}

export function useProductColor() {
  return useContext(ProductColorContext);
}
