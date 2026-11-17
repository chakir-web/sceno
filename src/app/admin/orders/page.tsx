import Link from "next/link";
import { assignOrderForm } from "@/lib/actions/orders";
import { StatusPill } from "@/components/office/indicators";
import { PageIntro, Pagination } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { statusLabel } from "@/lib/i18n";
import { pageNumber } from "@/lib/http";
import { confirmationStatuses, shipmentStatuses } from "@/lib/orders/transitions";
import { listConfirmers, listOrders } from "@/lib/services/orders";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { locale, dict } = await getI18n();
  const [orders, confirmers] = await Promise.all([
    listOrders({ q: params.q, confirmation: params.confirmation, shipment: params.shipment, page: pageNumber(params.page), unassigned: params.unassigned === "1" }),
    listConfirmers(),
  ]);
  return (
    <div>
      <PageIntro title={dict.admin.orders.title} />
      <form className="mb-4 grid gap-3 md:grid-cols-5">
        <input className="field" name="q" defaultValue={params.q} placeholder={dict.admin.orders.search} />
        <select className="field" name="confirmation" defaultValue={params.confirmation ?? ""}>
          <option value="">{dict.common.all}</option>
          {confirmationStatuses.map((status) => <option key={status} value={status}>{statusLabel(locale, "confirmation", status)}</option>)}
        </select>
        <select className="field" name="shipment" defaultValue={params.shipment ?? ""}>
          <option value="">{dict.common.all}</option>
          {shipmentStatuses.map((status) => <option key={status} value={status}>{statusLabel(locale, "shipment", status)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="unassigned" value="1" defaultChecked={params.unassigned === "1"} />{dict.admin.orders.unassigned}</label>
        <button className="btn btn-primary" type="submit">{dict.common.filter}</button>
      </form>
      <div className="overflow-x-auto border border-line bg-ivory">
        <table className="data">
          <thead><tr><th>{dict.track.number}</th><th>{dict.common.name}</th><th>{dict.common.city}</th><th>{dict.common.total}</th><th>{dict.common.status}</th><th>{dict.admin.orders.confirmer}</th></tr></thead>
          <tbody>
            {orders.data.items.map((order) => (
              <tr key={order.id}>
                <td><Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link><span className="block text-xs text-stone">{formatDate(order.createdAt, locale)}</span></td>
                <td>{order.fullName}<span className="block text-xs text-stone">{order.phone}</span></td>
                <td>{order.city}</td>
                <td>{formatMoney(order.totalMad, locale)}</td>
                <td><div className="flex flex-col items-start gap-1"><StatusPill locale={locale} kind="confirmation" status={order.confirmationStatus} /><StatusPill locale={locale} kind="shipment" status={order.shipmentStatus} /></div></td>
                <td>
                  <form action={assignOrderForm} className="flex gap-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <select className="field" name="confirmerId" defaultValue={order.assignedConfirmerId ?? ""}>
                      <option value="">{dict.admin.orders.unassigned}</option>
                      {confirmers.data.filter((person) => person.isActive).map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
                    </select>
                    <button className="text-sm" type="submit">{dict.admin.orders.assign}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!orders.data.items.length ? <p className="mt-4 text-sm text-stone">{dict.admin.orders.empty}</p> : null}
      <Pagination page={pageNumber(params.page)} total={orders.data.total} pageSize={orders.data.pageSize} pathname="/admin/orders" params={params} />
    </div>
  );
}
