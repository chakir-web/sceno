import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectOrder } from "@/components/store/direct-order";
import { ProductView } from "@/components/store/meta-events";
import { ProductColorProvider } from "@/components/store/product-color";
import { AddToCart, Gallery } from "@/components/store/purchase";
import { ProductCard } from "@/components/store/product-card";
import { getI18n } from "@/lib/i18n/server";
import { getProductBySlug, listSimilar } from "@/lib/services/catalog";
import { listRates } from "@/lib/services/settings";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await getI18n();
  const product = await getProductBySlug(slug, locale);
  if (!product.data) return { title: { absolute: "SCENO" } };
  return { title: { absolute: `${product.data.name} — SCENO` }, description: product.data.shortDescription || product.data.description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { locale, dict } = await getI18n();
  const product = await getProductBySlug(slug, locale);
  if (!product.data) notFound();
  const direct = product.data.slug === "poncho-nuage";
  const similar = direct ? [] : await listSimilar(product.data, locale);
  const rates = direct ? await listRates(false) : null;
  const cities = rates?.data.map((rate) => ({ city: rate.city, feeMad: rate.feeMad })) ?? [];
  const casablanca = cities.find((item) => item.city.trim().toLocaleLowerCase("fr") === "casablanca");
  return (
    <article>
      {direct ? null : <Link href="/products" className="text-sm text-stone">{dict.product.back}</Link>}
      <ProductColorProvider product={product.data}>
      <ProductView product={product.data} />
      <div className="mt-6 grid items-start gap-10 lg:grid-cols-2">
        <Gallery product={product.data} />
        {direct ? (
          <DirectOrder product={product.data} cities={cities} defaultCity={casablanca?.city ?? cities[0]?.city ?? ""} />
        ) : (
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-champagne">{product.data.categoryName}</p>
          <h1 className="mt-3 font-display text-5xl md:text-6xl">{product.data.name}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-stone">{product.data.shortDescription}</p>
          <AddToCart product={product.data} />
          <h2 className="mt-10 text-[11px] uppercase tracking-[0.16em] text-stone">{dict.product.description}</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7">{product.data.description}</p>
        </div>
        )}
      </div>
      </ProductColorProvider>
      {similar.length ? (
        <section className="mt-16">
          <h2 className="font-display text-4xl">{dict.product.similar}</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {similar.map((item) => <ProductCard key={item.id} product={item} locale={locale} promoLabel={dict.catalog.promo} soldOut={dict.catalog.soldOut} />)}
          </div>
        </section>
      ) : null}
    </article>
  );
}
