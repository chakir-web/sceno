"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart, useI18n } from "@/components/providers";
import { imagesForColor } from "@/lib/catalog/images";
import { trackAddToCart } from "@/lib/analytics/ga";
import { metaFunnelEventId } from "@/lib/meta/event-id";
import { getMetaProductData } from "@/lib/meta/product";
import { reportMeta } from "@/lib/meta/pixel";
import { catalogContentId, tiktokCommerce } from "@/lib/tiktok/commerce";
import { reportTikTok } from "@/lib/tiktok/pixel";
import { unitPrice } from "@/lib/pricing";
import { useProductColor } from "@/components/store/product-color";
import { formatMoney } from "@/lib/utils";
import type { CatalogProduct } from "@/types/commerce";

export { Gallery } from "@/components/store/gallery";

export function AddToCart({ product }: { product: CatalogProduct }) {
  const { dict, locale } = useI18n();
  const { add } = useCart();
  const setColor = useProductColor()?.setColor;
  const variants = product.variants.filter((variant) => variant.isActive);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 1600);
    return () => window.clearTimeout(timer);
  }, [added]);
  const variant = variants.find((item) => item.id === variantId) ?? variants[0];
  useEffect(() => {
    setColor?.(variant?.color ?? null);
  }, [setColor, variant?.color]);
  const price = variant ? unitPrice(product.priceMad, product.promoPriceMad, variant.priceMad) : unitPrice(product.priceMad, product.promoPriceMad, null);
  const sizes = useMemo(() => Array.from(new Set(variants.map((item) => item.size).filter(Boolean))), [variants]);
  const colors = useMemo(() => variants.filter((item) => !variant?.size || item.size === variant.size), [variant, variants]);
  if (!variant) return <p className="text-sm">{dict.product.unavailable}</p>;

  return (
    <div className="mt-8 grid gap-5">
      <div>
        <p className="font-display text-4xl">{formatMoney(price, locale)}</p>
        {price < product.priceMad ? <p className="text-sm text-stone line-through">{formatMoney(product.priceMad, locale)}</p> : null}
      </div>
      {sizes.length > 0 ? (
        <label className="grid gap-2 text-sm">
          {dict.product.size}
          <select className="field" value={variant.size ?? ""} onChange={(event) => {
            const next = variants.find((item) => item.size === event.target.value);
            if (next) setVariantId(next.id);
          }}>
            {sizes.map((size) => <option key={size} value={size ?? ""}>{size}</option>)}
          </select>
        </label>
      ) : null}
      {colors.some((item) => item.color) ? (
        <div>
          <p className="text-sm">{dict.product.color}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((item) => (
              <button key={item.id} type="button" className={`border px-3 py-2 text-sm ${item.id === variant.id ? "border-ink" : "border-line"}`} onClick={() => setVariantId(item.id)}>
                <span className="me-2 inline-block h-3 w-3" style={{ background: item.colorHex || "#C6B69B" }} />
                {item.color}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="text-sm text-stone">{dict.product.stock}: {variant.stockQuantity}{variant.stockQuantity > 0 && variant.stockQuantity <= product.lowStockThreshold ? ` · ${dict.product.lowStock}` : ""}</p>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-ghost" aria-label={dict.a11y.decreaseQty} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
        <span className="min-w-8 text-center">{quantity}</span>
        <button type="button" className="btn btn-ghost" aria-label={dict.a11y.increaseQty} onClick={() => setQuantity((value) => Math.min(variant.stockQuantity, 20, value + 1))}>+</button>
      </div>
      <button
        type="button"
        className={`btn ${added ? "btn-added" : "btn-primary"}`}
        disabled={variant.stockQuantity < 1}
        onClick={() => {
          add({
            productId: product.id,
            variantId: variant.id,
            quantity: Math.min(quantity, variant.stockQuantity),
            name: product.name,
            slug: product.slug,
            image: imagesForColor(product.images, variant.color)[0]?.url ?? null,
            unitPrice: price,
            variantLabel: [variant.size, variant.color].filter(Boolean).join(" / "),
            sku: variant.sku || product.sku,
          });
          const addedQuantity = Math.min(quantity, variant.stockQuantity);
          const meta = getMetaProductData(product, { variantSku: variant.sku, quantity: addedQuantity, unitPrice: price });
          if (meta) reportMeta("AddToCart", meta, metaFunnelEventId("AddToCart"));
          reportTikTok("AddToCart", tiktokCommerce([{ id: catalogContentId(product, variant), name: product.name, quantity: addedQuantity, price }], price * addedQuantity, product.categoryName ?? undefined), crypto.randomUUID());
          trackAddToCart({
            id: catalogContentId(product, variant),
            name: product.name,
            variant: [variant.size, variant.color].filter(Boolean).join(" / ") || undefined,
            category: product.categoryName ?? undefined,
            price,
            quantity: addedQuantity,
          }, price * addedQuantity);
          setAdded(true);
        }}
      >
        {added ? dict.product.addedMark : dict.product.add}
      </button>
      <p className="text-xs text-stone">{dict.product.sku}: {variant.sku}</p>
    </div>
  );
}

export function QuickAdd({ product }: { product: CatalogProduct }) {
  const { dict } = useI18n();
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((item) => item.isActive && item.stockQuantity > 0);
  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 1600);
    return () => window.clearTimeout(timer);
  }, [added]);
  if (!variant) return null;
  const price = unitPrice(product.priceMad, product.promoPriceMad, variant.priceMad);
  const variantLabel = [variant.size, variant.color].filter(Boolean).join(" / ");
  const several = product.variants.filter((item) => item.isActive && item.stockQuantity > 0).length > 1;
  return (
    <div className="mt-3">
      {several && variantLabel ? <p className="mb-2 text-[11px] text-stone">{variantLabel}</p> : null}
      <button
        type="button"
        className={`btn w-full px-2 text-center text-xs leading-4 ${added ? "btn-added" : "btn-primary"}`}
        onClick={() => {
          add({
            productId: product.id,
            variantId: variant.id,
            quantity: 1,
            name: product.name,
            slug: product.slug,
            image: imagesForColor(product.images, variant.color)[0]?.url ?? null,
            unitPrice: price,
            variantLabel,
            sku: variant.sku || product.sku,
          });
          const meta = getMetaProductData(product, { variantSku: variant.sku, quantity: 1, unitPrice: price });
          if (meta) reportMeta("AddToCart", meta, metaFunnelEventId("AddToCart"));
          reportTikTok("AddToCart", tiktokCommerce([{ id: catalogContentId(product, variant), name: product.name, quantity: 1, price }], price, product.categoryName ?? undefined), crypto.randomUUID());
          trackAddToCart({
            id: catalogContentId(product, variant),
            name: product.name,
            variant: variantLabel || undefined,
            category: product.categoryName ?? undefined,
            price,
            quantity: 1,
          }, price);
          setAdded(true);
        }}
      >
        {added ? dict.product.addedMark : dict.product.add}
      </button>
    </div>
  );
}
