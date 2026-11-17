import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { setLocale } from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/fr";
import type { Locale } from "@/lib/i18n/locales";
import type { CatalogCategory } from "@/types/commerce";
import { CartButton, MobileNav } from "@/components/store/nav-client";

export function Header({ locale, dict, categories }: { locale: Locale; dict: Dictionary; categories: CatalogCategory[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex max-w-store items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <MobileNav locale={locale} dict={dict} categories={categories} />
          <Link href="/" aria-label="SCENO" className="shrink-0"><Logo className="h-6 w-auto sm:h-8" /></Link>
        </div>
        <nav className="hidden flex-wrap items-center gap-x-6 gap-y-2 text-sm md:flex" aria-label="principal">
          <Link href="/products">{dict.nav.shop}</Link>
          <Link href="/track-order">{dict.nav.track}</Link>
          {categories.map((category) => (
            <Link key={category.id} href={`/categories/${category.slug}`}>{category.name}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <form action="/products" className="hidden lg:block">
            <input name="q" aria-label={dict.a11y.search} placeholder={dict.nav.searchPlaceholder} className="field w-44 py-2" />
          </form>
          <form action={setLocale} className="flex border border-line">
            {(["fr", "ar"] as const).map((value) => (
              <button key={value} name="locale" value={value} className={`px-2 py-1 text-xs ${locale === value ? "bg-ink text-ivory" : ""}`} aria-pressed={locale === value}>
                {value === "fr" ? dict.lang.fr : dict.lang.ar}
              </button>
            ))}
          </form>
          <CartButton label={dict.nav.cart} />
        </div>
      </div>
    </header>
  );
}
