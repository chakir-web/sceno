import Link from "next/link";
import { Media } from "@/components/store/media";
import type { Locale } from "@/lib/i18n/locales";
import { displayPrice } from "@/lib/services/catalog";
import { formatMoney } from "@/lib/utils";
import type { CatalogProduct } from "@/types/commerce";

export function ProductCard({ product, locale, promoLabel, soldOut, choose }: { product: CatalogProduct; locale: Locale; promoLabel: string; soldOut: string; choose?: string }) {
  const price = displayPrice(product);
  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        <Media src={product.images[0]?.url ?? null} alt={product.name} className="transition duration-500 group-hover:scale-[1.03]" />
        {product.stockQuantity <= 0 ? <span className="absolute start-3 top-3 bg-ink px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-ivory">{soldOut}</span> : null}
        {price.compare ? <span className="absolute end-3 top-3 bg-ivory/90 px-2 py-1 text-[10px] uppercase tracking-[0.14em]">{promoLabel}</span> : null}
      </div>
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone">{product.categoryName}</p>
        <h3 className="mt-1 text-sm leading-5">{product.name}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-sm">{formatMoney(price.amount, locale)}</p>
          {price.compare ? <p className="text-xs text-stone line-through">{formatMoney(price.compare, locale)}</p> : null}
        </div>
        {choose ? <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-champagne">{choose}</p> : null}
      </div>
    </Link>
  );
}
