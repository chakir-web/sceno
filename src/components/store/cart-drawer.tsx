"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCart, useI18n } from "@/components/providers";
import { formatMoney } from "@/lib/utils";

export function CartToast() {
  const { notice, dismissNotice } = useCart();
  const { dict, locale } = useI18n();
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismissNotice, 4200);
    return () => window.clearTimeout(timer);
  }, [notice, dismissNotice]);
  if (!notice) return null;
  return (
    <div className="pointer-events-none fixed inset-x-3 top-[4.5rem] z-[60] flex justify-center sm:inset-x-auto sm:end-4 sm:top-24 sm:w-[22rem]">
      <div role="status" className="toast-in pointer-events-auto w-full border border-line bg-ivory p-3 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
        <p className="text-[11px] uppercase tracking-[0.14em] text-champagne">{dict.cart.addedTitle}</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-14 w-12 shrink-0 overflow-hidden bg-mist">
            {notice.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={notice.image} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{notice.name}</p>
            {notice.variantLabel ? <p className="truncate text-xs text-stone">{notice.variantLabel}</p> : null}
            <p className="text-xs text-stone">× {notice.quantity} · {formatMoney(notice.unitPrice * notice.quantity, locale)}</p>
          </div>
        </div>
        <Link href="/cart" className="btn btn-ghost mt-3 w-full" onClick={dismissNotice}>{dict.cart.see}</Link>
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { items, drawer, closeDrawer, update } = useCart();
  const { dict, locale } = useI18n();
  const pathname = usePathname();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    closeDrawer();
    // La fermeture suit un vrai changement de page, pas l'ouverture du tiroir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("a, button, input, select, textarea")].filter((node) => !node.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawer, closeDrawer]);

  if (!drawer || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink/30" onClick={closeDrawer}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="drawer-panel absolute inset-y-0 end-0 flex h-full w-full max-w-[26rem] flex-col bg-ivory shadow-[0_0_40px_rgba(23,23,23,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <h2 id={titleId} className="font-display text-3xl">{dict.cart.title}</h2>
          <button ref={closeRef} type="button" className="grid h-11 w-11 place-items-center border border-line" aria-label={dict.a11y.closeCart} onClick={closeDrawer}>×</button>
        </div>
        {items.length ? (
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto px-4">
            {items.map((item) => (
              <li key={item.variantId} className="flex gap-3 py-4">
                <div className="h-20 w-16 shrink-0 overflow-hidden bg-mist">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.name}</p>
                  {item.variantLabel ? <p className="truncate text-xs text-stone">{item.variantLabel}</p> : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button className="grid h-11 w-11 place-items-center border border-line" type="button" aria-label={dict.a11y.decreaseQty} onClick={() => update(item.variantId, item.quantity - 1)}>−</button>
                      <span className="min-w-6 text-center text-sm">{item.quantity}</span>
                      <button className="grid h-11 w-11 place-items-center border border-line" type="button" aria-label={dict.a11y.increaseQty} onClick={() => update(item.variantId, item.quantity + 1)}>+</button>
                    </div>
                    <p className="text-sm">{formatMoney(item.unitPrice * item.quantity, locale)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p>{dict.cart.empty}</p>
            <Link href="/products" className="btn btn-primary" onClick={closeDrawer}>{dict.cart.discover}</Link>
          </div>
        )}
        {items.length ? (
          <div className="grid gap-3 border-t border-line px-4 py-4">
            <div className="flex justify-between text-sm"><span>{dict.cart.subtotal}</span><span>{formatMoney(subtotal, locale)}</span></div>
            <button type="button" className="btn btn-ghost w-full" onClick={closeDrawer}>{dict.cart.keepShopping}</button>
            <Link href="/cart" className="btn btn-ghost w-full" onClick={closeDrawer}>{dict.cart.view}</Link>
            <Link href="/checkout" className="btn btn-primary w-full" onClick={closeDrawer}>{dict.cart.checkout}</Link>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
