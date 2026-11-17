import Link from "next/link";
import { StatusPill } from "@/components/office/indicators";
import { PageIntro, Pagination } from "@/components/ui/primitives";
import { pageNumber } from "@/lib/http";
import { requireConfirmer } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { statusLabel } from "@/lib/i18n";
import { confirmationStatuses } from "@/lib/orders/transitions";
import { listOrders } from "@/lib/services/orders";
import { formatMoney } from "@/lib/utils";

export default async function ConfirmerOrdersPage({ searchParams }: { searchParams: Promise<{ confirmation?: string; page?: string }> }) {
  const params = await searchParams;
  const { profile } = await requireConfirmer();
  const { locale, dict } = await getI18n();
  const orders = await listOrders({ assignedTo: profile.id, confirmation: params.confirmation, page: pageNumber(params.page) });
  return (
    <div>
      <PageIntro title={dict.confirmer.orders.title} />
      <form className="mb-4 flex gap-3">
        <select className="field" name="confirmation" defaultValue={params.confirmation ?? ""}>
          <option value="">{dict.common.all}</option>
          {confirmationStatuses.map((status) => <option key={status} value={status}>{statusLabel(locale, "confirmation", status)}</option>)}
        </select>
        <button className="btn btn-ghost" type="submit">{dict.common.filter}</button>
      </form>
      <div className="overflow-x-auto border border-line bg-ivory">
        <table className="data">
          <thead><tr><th>{dict.track.number}</th><th>{dict.common.name}</th><th>{dict.common.phone}</th><th>{dict.common.total}</th><th>{dict.common.status}</th></tr></thead>
          <tbody>
            {orders.data.items.map((order) => (
              <tr key={order.id}>
                <td><Link href={`/confirmer/orders/${order.id}`}>{order.orderNumber}</Link></td>
                <td>{order.fullName}</td>
                <td>{order.phone}</td>
                <td>{formatMoney(order.totalMad, locale)}</td>
                <td><StatusPill locale={locale} kind="confirmation" status={order.confirmationStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!orders.data.items.length ? <p className="mt-4 text-sm">{dict.confirmer.orders.empty}</p> : null}
      <Pagination page={pageNumber(params.page)} total={orders.data.total} pageSize={orders.data.pageSize} pathname="/confirmer/orders" params={params} />
    </div>
  );
}
