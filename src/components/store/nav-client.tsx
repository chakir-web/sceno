"use client";

import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Logo } from "@/components/brand/logo";
import { CartDrawer } from "@/components/store/cart-drawer";
import { useCart } from "@/components/providers";
import type { Dictionary } from "@/lib/i18n/fr";
import type { Locale } from "@/lib/i18n/locales";
import type { CatalogCategory } from "@/types/commerce";

export function CartButton({ label }: { label: string }) {
  const { count, bump, openDrawer } = useCart();
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (!bump || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPop(true);
    const timer = window.setTimeout(() => setPop(false), 420);
    return () => window.clearTimeout(timer);
  }, [bump]);
  return (
    <>
      <button type="button" className="relative grid h-11 w-11 place-items-center border border-line" aria-label={`${label}${count ? ` ${count}` : ""}`} onClick={openDrawer}>
        <ShoppingBag size={18} />
        {count > 0 ? (
          <span className={`absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center px-1 text-[10px] text-ivory ${pop ? "cart-badge-pop" : "bg-ink"}`}>{count}</span>
        ) : null}
      </button>
      <CartDrawer />
    </>
  );
}

export function MobileNav({ dict, categories }: { locale: Locale; dict: Dictionary; categories: CatalogCategory[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { openDrawer } = useCart();
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <>
      <button type="button" className="grid h-10 w-10 place-items-center border border-line bg-ivory md:hidden" aria-label={dict.a11y.openMenu} aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu size={18} />
      </button>
      {open && mounted ? createPortal(
        <div className="fixed inset-0 z-50 bg-ivory md:hidden" onClick={() => setOpen(false)}>
          <div className="flex h-full w-full flex-col overflow-y-auto bg-ivory p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <Logo className="h-8 w-auto" />
              <button type="button" className="grid h-10 w-10 place-items-center border border-line bg-ivory" aria-label={dict.a11y.closeMenu} onClick={() => setOpen(false)}><X /></button>
            </div>
            <form action="/products" className="mt-8">
              <input name="q" className="field" placeholder={dict.nav.searchPlaceholder} aria-label={dict.a11y.search} />
            </form>
            <nav className="mt-8 grid gap-4 text-lg">
              <Link href="/" onClick={() => setOpen(false)}>{dict.nav.home}</Link>
              <Link href="/products" onClick={() => setOpen(false)}>{dict.nav.shop}</Link>
              <Link href="/track-order" onClick={() => setOpen(false)}>{dict.nav.track}</Link>
              <button type="button" className="text-start text-lg" onClick={() => { setOpen(false); openDrawer(); }}>{dict.nav.cart}</button>
              {categories.map((category) => (
                <Link key={category.id} href={`/categories/${category.slug}`} onClick={() => setOpen(false)}>{category.name}</Link>
              ))}
            </nav>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
