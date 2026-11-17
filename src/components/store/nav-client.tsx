"use client";

import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useCart } from "@/components/providers";
import type { Dictionary } from "@/lib/i18n/fr";
import type { Locale } from "@/lib/i18n/locales";
import type { CatalogCategory } from "@/types/commerce";

export function CartButton({ label }: { label: string }) {
  const { count } = useCart();
  return (
    <Link href="/cart" className="relative grid h-10 w-10 place-items-center border border-line" aria-label={label}>
      <ShoppingBag size={18} />
      <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center bg-ink px-1 text-[10px] text-ivory">{count}</span>
    </Link>
  );
}

export function MobileNav({ dict, categories }: { locale: Locale; dict: Dictionary; categories: CatalogCategory[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="grid h-10 w-10 place-items-center border border-line md:hidden" aria-label={dict.a11y.openMenu} onClick={() => setOpen(true)}>
        <Menu size={18} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-ink/30 md:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-[min(100%,360px)] bg-ivory p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <Logo className="h-8 w-auto" />
              <button aria-label={dict.a11y.closeMenu} onClick={() => setOpen(false)}><X /></button>
            </div>
            <form action="/products" className="mt-8">
              <input name="q" className="field" placeholder={dict.nav.searchPlaceholder} aria-label={dict.a11y.search} />
            </form>
            <nav className="mt-8 grid gap-4 text-lg">
              <Link href="/" onClick={() => setOpen(false)}>{dict.nav.home}</Link>
              <Link href="/products" onClick={() => setOpen(false)}>{dict.nav.shop}</Link>
              <Link href="/track-order" onClick={() => setOpen(false)}>{dict.nav.track}</Link>
              <Link href="/cart" onClick={() => setOpen(false)}>{dict.nav.cart}</Link>
              {categories.map((category) => (
                <Link key={category.id} href={`/categories/${category.slug}`} onClick={() => setOpen(false)}>{category.name}</Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
