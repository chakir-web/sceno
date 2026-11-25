import type { Metadata } from "next";
import { SearchView } from "@/components/store/meta-events";
import { ProductCard } from "@/components/store/product-card";
import { EmptyState, Pagination } from "@/components/ui/primitives";
import { SetupPanel } from "@/components/store/setup-panel";
import { getI18n } from "@/lib/i18n/server";
import { pageNumber } from "@/lib/http";
import { listCategories, listProducts } from "@/lib/services/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: { absolute: dict.meta.shopTitle }, description: dict.meta.shopDescription };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { locale, dict } = await getI18n();
  const page = pageNumber(params.page);
  const [products, categories] = await Promise.all([
    listProducts({ locale, page, q: params.q, category: params.category, sort: params.sort, inStock: params.stock === "1" }),
    listCategories(locale),
  ]);
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-champagne">{dict.catalog.lead}</p>
      <h1 className="mt-2 font-display text-5xl">{dict.catalog.title}</h1>
      <SearchView query={params.q} />
      <form className="mt-8 grid gap-3 md:grid-cols-4">
        <input className="field" name="q" defaultValue={params.q} placeholder={dict.catalog.search} />
        <select className="field" name="category" defaultValue={params.category ?? ""}>
          <option value="">{dict.catalog.allCategories}</option>
          {categories.data.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
        </select>
        <select className="field" name="sort" defaultValue={params.sort ?? "new"}>
          <option value="new">{dict.catalog.sortNew}</option>
          <option value="price_asc">{dict.catalog.sortPriceAsc}</option>
          <option value="price_desc">{dict.catalog.sortPriceDesc}</option>
        </select>
        <select className="field" name="stock" defaultValue={params.stock ?? ""}>
          <option value="">{dict.catalog.allStock}</option>
          <option value="1">{dict.catalog.inStock}</option>
        </select>
        <button className="btn btn-primary md:col-span-4 md:w-fit" type="submit">{dict.common.filter}</button>
      </form>
      {!products.configured || !products.ready ? <div className="mt-8"><SetupPanel dict={dict} /></div> : null}
      <p className="mt-6 text-sm text-stone">{products.data.total} {dict.catalog.results}</p>
      {products.data.items.length ? (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {products.data.items.map((product) => <ProductCard key={product.id} product={product} locale={locale} promoLabel={dict.catalog.promo} soldOut={dict.catalog.soldOut} addLabel={dict.product.add} />)}
        </div>
      ) : <div className="mt-6"><EmptyState title={dict.catalog.empty} /></div>}
      <Pagination page={page} total={products.data.total} pageSize={products.data.pageSize} pathname="/products" params={params} />
    </div>
  );
}
