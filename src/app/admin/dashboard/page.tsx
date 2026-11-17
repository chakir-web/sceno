import Link from "next/link";
import { AlertTriangle, Banknote, Check, CircleAlert, Clock, PackageCheck, Percent, ShoppingBag, Truck, Undo2, UserRound, Wallet } from "lucide-react";
import { OrdersChart } from "@/components/admin/charts";
import { OfficeStat, StatusPill } from "@/components/office/indicators";
import { PageIntro } from "@/components/ui/primitives";
import { SetupPanel } from "@/components/store/setup-panel";
import { getI18n } from "@/lib/i18n/server";
import { getAdminDashboard } from "@/lib/services/dashboard";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const { locale, dict } = await getI18n();
  const dashboard = await getAdminDashboard();
  const copy = dict.admin.dashboard;
  if (!dashboard.ready) return <SetupPanel dict={dict} />;
  const data = dashboard.data;
  return (
    <div>
      <PageIntro eyebrow="SCENO" title={copy.title} body={copy.lead} />
      <section>
        <h2 className="mb-3 text-[11px] uppercase tracking-[0.16em] text-stone">{copy.attention}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OfficeStat tone={data.pendingConfirmation > 0 ? "warning" : "neutral"} icon={Clock} label={copy.pending} value={formatNumber(data.pendingConfirmation, locale)} />
          <OfficeStat tone={data.unassigned > 0 ? "warning" : "neutral"} icon={UserRound} label={copy.unassigned} value={formatNumber(data.unassigned, locale)} />
          <OfficeStat tone={data.lowStock > 0 ? "warning" : "success"} icon={AlertTriangle} label={copy.lowStock} value={formatNumber(data.lowStock, locale)} />
          <OfficeStat tone={data.cancelled > 0 ? "danger" : "neutral"} icon={CircleAlert} label={copy.cancelled} value={formatNumber(data.cancelled, locale)} />
        </div>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-[11px] uppercase tracking-[0.16em] text-stone">{copy.activity}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OfficeStat tone="info" icon={ShoppingBag} label={copy.orders} value={formatNumber(data.ordersTotal, locale)} />
          <OfficeStat tone="info" icon={Clock} label={copy.today} value={formatNumber(data.ordersToday, locale)} />
          <OfficeStat tone="success" icon={Check} label={copy.confirmed} value={formatNumber(data.confirmed, locale)} />
          <OfficeStat tone="info" icon={Truck} label={copy.shipped} value={formatNumber(data.shipped, locale)} />
          <OfficeStat tone="success" icon={PackageCheck} label={copy.delivered} value={formatNumber(data.delivered, locale)} />
          <OfficeStat tone={data.returned > 0 ? "danger" : "neutral"} icon={Undo2} label={copy.returned} value={formatNumber(data.returned, locale)} />
        </div>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-[11px] uppercase tracking-[0.16em] text-stone">{copy.money}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <OfficeStat tone="success" icon={Banknote} label={copy.collected} value={formatMoney(data.revenueCollected, locale)} hint={copy.collectedHint} />
          <OfficeStat tone="info" icon={Wallet} label={copy.pipeline} value={formatMoney(data.pipelineConfirmed, locale)} />
          <OfficeStat tone="info" icon={Percent} label={copy.confirmationRate} value={formatPercent(data.confirmationRate, locale)} />
          <OfficeStat tone="info" icon={Percent} label={copy.deliveryRate} value={formatPercent(data.deliveryRate, locale)} />
        </div>
      </section>
      <div className="mt-6"><OrdersChart data={data.series} label={copy.chartOrders} /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="border border-line bg-ivory p-5">
          <h2 className="font-display text-3xl">{copy.recent}</h2>
          <ul className="mt-4 divide-y divide-line">
            {data.recentOrders.map((order) => (
              <li key={order.id} className="grid items-center gap-x-4 gap-y-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Link href={`/admin/orders/${order.id}`} className="min-w-0">
                  <span className="block">{order.orderNumber}</span>
                  <span className="block truncate text-stone">{order.fullName}</span>
                </Link>
                <span className="tabular-nums">{formatMoney(order.totalMad, locale)}</span>
                <StatusPill locale={locale} kind="confirmation" status={order.confirmationStatus} />
                <span className="text-xs text-stone sm:col-span-3">{formatDate(order.createdAt, locale, false)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="border border-line bg-ivory p-5">
          <h2 className="font-display text-3xl">{copy.popular}</h2>
          <ul className="mt-4 divide-y divide-line">
            {data.popularProducts.map((product) => (
              <li key={product.name} className="flex justify-between py-3 text-sm"><span>{product.name}</span><span>{product.quantity} · {formatMoney(product.amount, locale)}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
