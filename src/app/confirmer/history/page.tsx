import Link from "next/link";
import { StatusPill } from "@/components/office/indicators";
import { PageIntro, Pagination } from "@/components/ui/primitives";
import { pageNumber } from "@/lib/http";
import { requireConfirmer } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { listOrders } from "@/lib/services/orders";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const { profile } = await requireConfirmer();
  const { locale, dict } = await getI18n();
  const orders = await listOrders({ assignedTo: profile.id, history: true, page: pageNumber(params.page) });
  return (
    <div>
      <PageIntro title={dict.confirmer.history.title} />
      <ul className="divide-y divide-line border-y border-line">
        {orders.data.items.map((order) => (
          <li key={order.id} className="flex justify-between py-3 text-sm">
            <Link href={`/confirmer/orders/${order.id}`}>{order.orderNumber} · {order.fullName}</Link>
            <span className="flex flex-col items-end gap-1 text-end">{formatMoney(order.totalMad, locale)}<StatusPill locale={locale} kind="confirmation" status={order.confirmationStatus} /><span className="text-xs text-stone">{formatDate(order.createdAt, locale, false)}</span></span>
          </li>
        ))}
      </ul>
      {!orders.data.items.length ? <p className="mt-4 text-sm">{dict.confirmer.history.empty}</p> : null}
      <Pagination page={pageNumber(params.page)} total={orders.data.total} pageSize={orders.data.pageSize} pathname="/confirmer/history" params={params} />
    </div>
  );
}
