import { ProductCard } from "@/components/store/product-card";
import { EmptyState } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { categorySlugForAlias, listCategories, listProducts } from "@/lib/services/catalog";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { locale, dict } = await getI18n();
  const categories = await listCategories(locale);
  let category = categories.data.find((item) => item.slug === slug);
  if (!category) {
    const target = await categorySlugForAlias(slug);
    if (target) category = categories.data.find((item) => item.slug === target);
  }
  const products = await listProducts({ locale, category: category?.slug ?? slug });
  return (
    <div>
      <h1 className="font-display text-5xl">{category?.name ?? dict.catalog.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone">{category?.description}</p>
      {products.data.items.length ? (
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {products.data.items.map((product) => <ProductCard key={product.id} product={product} locale={locale} promoLabel={dict.catalog.promo} soldOut={dict.catalog.soldOut} choose={dict.catalog.choose} />)}
        </div>
      ) : <div className="mt-8"><EmptyState title={dict.catalog.empty} /></div>}
    </div>
  );
}
