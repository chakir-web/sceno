"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { CatalogProduct } from "@/types/commerce";

const ProductColorContext = createContext<{ color: string | null; setColor: (color: string | null) => void } | null>(null);

export function ProductColorProvider({ product, children }: { product: CatalogProduct; children: React.ReactNode }) {
  const initial = product.variants.find((variant) => variant.isActive)?.color ?? null;
  const [color, setColor] = useState(initial);
  const value = useMemo(() => ({ color, setColor }), [color]);
  return <ProductColorContext.Provider value={value}>{children}</ProductColorContext.Provider>;
}

export function useProductColor() {
  return useContext(ProductColorContext);
}
