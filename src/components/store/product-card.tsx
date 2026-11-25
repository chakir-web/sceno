import Link from "next/link";
import { Media } from "@/components/store/media";
import type { Locale } from "@/lib/i18n/locales";
import { displayPrice } from "@/lib/services/catalog";
import { StorePrice } from "@/components/store/price";
import type { CatalogProduct } from "@/types/commerce";

export function ProductCard({ product, locale, promoLabel, soldOut, addLabel }: { product: CatalogProduct; locale: Locale; promoLabel: string; soldOut: string; addLabel: string }) {
  const price = displayPrice(product);
  return (
    <article className="flex h-full flex-col">
    <Link href={`/products/${product.slug}`} className="group block flex-1">
      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        <Media src={product.images[0]?.url ?? null} alt={product.name} className="transition duration-500 group-hover:scale-[1.03]" />
        {product.stockQuantity <= 0 ? <span className="absolute start-3 top-3 bg-ink px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-ivory">{soldOut}</span> : null}
        {price.compare ? <span className="absolute end-3 top-3 bg-ivory/90 px-2 py-1 text-[10px] uppercase tracking-[0.14em]">{promoLabel}</span> : null}
      </div>
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone">{product.categoryName}</p>
        <h3 className="mt-1 text-sm leading-5">{product.name}</h3>
        <div className="mt-2">
          <StorePrice amount={price.amount} compare={price.compare} locale={locale} />
        </div>
      </div>
    </Link>
    <Link href={`/products/${product.slug}`} className="btn btn-primary mt-3 w-full px-2 text-center text-xs leading-4">{addLabel}</Link>
    </article>
  );
}
