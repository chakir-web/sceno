import Link from "next/link";
import { deleteProductForm, setProductActiveForm } from "@/lib/actions/catalog";
import { FeaturedPill, PromoPill, StatePill, StockPill } from "@/components/office/indicators";
import { PageIntro, Pagination } from "@/components/ui/primitives";
import { SetupPanel } from "@/components/store/setup-panel";
import { getI18n } from "@/lib/i18n/server";
import { pageNumber } from "@/lib/http";
import { listProducts } from "@/lib/services/catalog";
import { formatMoney } from "@/lib/utils";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const { locale, dict } = await getI18n();
  const products = await listProducts({ locale, admin: true, page: pageNumber(params.page) });
  if (!products.ready) return <SetupPanel dict={dict} />;
  return (
    <div>
      <PageIntro title={dict.admin.products.title} action={<Link className="btn btn-primary" href="/admin/products/new">{dict.admin.products.new}</Link>} />
      <div className="overflow-x-auto border border-line bg-ivory">
        <table className="data">
          <thead><tr><th>{dict.common.name}</th><th>SKU</th><th>{dict.common.price}</th><th>{dict.common.quantity}</th><th>{dict.common.status}</th><th></th></tr></thead>
          <tbody>
            {products.data.items.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link href={`/admin/products/${product.id}`}>{product.nameFr}</Link>
                  {product.categoryName ? <p className="mt-1 text-xs text-stone">{product.categoryName}</p> : null}
                  {product.promoPriceMad != null || product.isFeatured ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {product.promoPriceMad != null ? <PromoPill>{dict.office.promo}</PromoPill> : null}
                      {product.isFeatured ? <FeaturedPill>{dict.office.featured}</FeaturedPill> : null}
                    </div>
                  ) : null}
                </td>
                <td>{product.sku}</td>
                <td>{formatMoney(product.promoPriceMad ?? product.priceMad, locale)}</td>
                <td><StockPill quantity={product.stockQuantity} threshold={product.lowStockThreshold} labels={{ ok: dict.office.stockOk, low: dict.office.stockLow, critical: dict.office.stockCritical, out: dict.office.stockOut }} /></td>
                <td><StatePill active={product.isActive} activeLabel={dict.common.active} inactiveLabel={dict.common.inactive} /></td>
                <td className="flex gap-2">
                  <form action={setProductActiveForm}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="active" value={String(!product.isActive)} /><button className="text-sm" type="submit">{product.isActive ? dict.common.inactive : dict.common.active}</button></form>
                  <form action={deleteProductForm}><input type="hidden" name="id" value={product.id} /><button className="text-sm text-red-900" type="submit">{dict.common.delete}</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={pageNumber(params.page)} total={products.data.total} pageSize={products.data.pageSize} pathname="/admin/products" params={params} />
    </div>
  );
}
