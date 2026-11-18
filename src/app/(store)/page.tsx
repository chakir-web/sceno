import Link from "next/link";
import { ProductCard } from "@/components/store/product-card";
import { SetupPanel } from "@/components/store/setup-panel";
import { getI18n } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/fr";
import type { Locale } from "@/lib/i18n/locales";
import { listCategories, listProducts } from "@/lib/services/catalog";
import type { CatalogCategory, CatalogProduct } from "@/types/commerce";

const audiences = ["femme", "homme", "enfant"] as const;
type Audience = (typeof audiences)[number];

const portraits: Record<Audience, string> = {
  femme: "/home/femme.webp",
  homme: "/home/homme.webp",
  enfant: "/home/enfant.webp",
};

function audienceOf(category: CatalogCategory): Audience | null {
  const hay = `${category.slug} ${category.nameFr}`.toLowerCase();
  if (hay.includes("femme")) return "femme";
  if (hay.includes("homme")) return "homme";
  if (hay.includes("enfant")) return "enfant";
  return null;
}

export default async function HomePage() {
  const { locale, dict } = await getI18n();
  const [featured, recent, categories] = await Promise.all([
    listProducts({ locale, featured: true }),
    listProducts({ locale }),
    listCategories(locale),
  ]);
  const leads: Record<Audience, string> = {
    femme: dict.home.femmeLead,
    homme: dict.home.hommeLead,
    enfant: dict.home.enfantLead,
  };
  const matched = audiences.flatMap((key) => {
    const category = categories.data.find((item) => audienceOf(item) === key);
    return category ? [{ key, category }] : [];
  });
  const collections = matched.length
    ? matched
    : categories.data.slice(0, 3).map((category, index) => ({ key: audiences[index] ?? "femme", category }));

  return (
    <div className="grid gap-16 md:gap-20">
      <section className="grid items-center gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:gap-12">
        <div className="min-w-0">
          <p className="max-w-full text-[11px] uppercase leading-5 tracking-[0.14em] text-champagne sm:tracking-[0.24em]">{dict.home.eyebrow}</p>
          <h1 className="mt-4 max-w-xl font-display text-[2.35rem] leading-[1.02] sm:text-5xl md:text-6xl lg:text-7xl">{dict.home.title}</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-stone">{dict.home.lead}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link className="btn btn-primary w-full sm:w-auto" href="/products">{dict.home.shopCta}</Link>
            <Link className="btn btn-ghost w-full sm:w-auto" href="#nouveautes">{dict.home.newCta}</Link>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden bg-mist sm:aspect-[16/10] lg:aspect-auto lg:min-h-[34rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home/hero.webp" alt={dict.home.heroAlt} className="absolute inset-0 h-full w-full object-cover object-[32%_center]" />
        </div>
      </section>

      {!featured.configured ? <SetupPanel dict={dict} /> : null}

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-4xl">{dict.home.categoriesTitle}</h2>
          <Link href="/products" className="shrink-0 text-sm">{dict.home.viewAll}</Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {collections.map(({ key, category }) => (
            <Link key={category.id} href={`/categories/${category.slug}`} className="group relative min-h-72 overflow-hidden bg-mist sm:min-h-96">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portraits[key]} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-ivory">
                <h3 className="font-display text-4xl leading-none">{category.name}</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-beige">{leads[key]}</p>
                <p className="mt-4 text-[11px] uppercase tracking-[0.16em]">{dict.home.collectionCta}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProductSection id="nouveautes" title={dict.home.newTitle} products={recent.data.items} locale={locale} dict={dict} />
      {featured.data.items.length ? <ProductSection title={dict.home.popularTitle} products={featured.data.items} locale={locale} dict={dict} /> : null}

      <section>
        <h2 className="font-display text-4xl">{dict.home.benefitsTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [dict.home.benefit1Title, dict.home.benefit1Body],
            [dict.home.benefit2Title, dict.home.benefit2Body],
            [dict.home.benefit3Title, dict.home.benefit3Body],
            [dict.home.benefit4Title, dict.home.benefit4Body],
          ].map(([title, body]) => (
            <article key={title} className="border border-line p-5">
              <h3 className="font-display text-2xl">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-stone">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductSection({ id, title, products, locale, dict }: { id?: string; title: string; products: CatalogProduct[]; locale: Locale; dict: Dictionary }) {
  return (
    <section id={id} className={id ? "scroll-mt-24" : undefined}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="font-display text-4xl">{title}</h2>
        <Link href="/products" className="shrink-0 text-sm">{dict.home.viewAll}</Link>
      </div>
      {products.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} locale={locale} promoLabel={dict.catalog.promo} soldOut={dict.catalog.soldOut} />)}
        </div>
      ) : <p className="text-sm text-stone">{dict.home.emptyProducts}</p>}
    </section>
  );
}
