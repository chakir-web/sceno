"use client";

import Link from "next/link";
import { useCart, useI18n } from "@/components/providers";
import { EmptyState } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/utils";

export function CartView() {
  const { items, update, remove } = useCart();
  const { dict, locale } = useI18n();
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (!items.length) {
    return <EmptyState title={dict.cart.empty} action={<Link className="btn btn-primary" href="/products">{dict.cart.continue}</Link>} />;
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <ul className="divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={item.variantId} className="flex gap-4 py-5">
            <div className="h-28 w-24 overflow-hidden bg-mist">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col">
              <Link href={`/products/${item.slug}`} className="font-medium">{item.name}</Link>
              <p className="text-sm text-stone">{item.variantLabel}</p>
              <div className="mt-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost px-3" type="button" onClick={() => update(item.variantId, item.quantity - 1)}>−</button>
                  <span>{item.quantity}</span>
                  <button className="btn btn-ghost px-3" type="button" onClick={() => update(item.variantId, item.quantity + 1)}>+</button>
                </div>
                <div className="text-end">
                  <p>{formatMoney(item.unitPrice * item.quantity, locale)}</p>
                  <button className="text-xs text-stone" type="button" onClick={() => remove(item.variantId)}>{dict.cart.remove}</button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <aside className="h-fit border border-line bg-white/40 p-6">
        <div className="flex justify-between text-sm"><span>{dict.cart.subtotal}</span><span>{formatMoney(subtotal, locale)}</span></div>
        <div className="mt-3 flex justify-between text-sm text-stone"><span>{dict.cart.shipping}</span><span>{dict.cart.shippingAtCheckout}</span></div>
        <div className="mt-4 flex justify-between border-t border-line pt-4"><span>{dict.cart.total}</span><span>{formatMoney(subtotal, locale)}</span></div>
        <p className="mt-4 text-xs leading-5 text-stone">{dict.cart.note}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-champagne">{dict.cart.cod}</p>
        <Link href="/checkout" className="btn btn-primary mt-6 w-full">{dict.cart.checkout}</Link>
      </aside>
    </div>
  );
}
