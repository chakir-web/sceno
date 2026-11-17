import Link from "next/link";
import { Check, CircleAlert, Inbox, Percent, Phone, PhoneOff } from "lucide-react";
import { OfficeStat, StatusPill } from "@/components/office/indicators";
import { PageIntro } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { getConfirmerDashboard } from "@/lib/services/dashboard";
import { formatMoney, formatNumber, formatPercent } from "@/lib/utils";

export default async function ConfirmerDashboardPage() {
  const { locale, dict } = await getI18n();
  const dashboard = await getConfirmerDashboard();
  const copy = dict.confirmer.dashboard;
  const data = dashboard.data;
  return (
    <div>
      <PageIntro title={copy.title} body={copy.lead} />
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <OfficeStat tone="info" icon={Inbox} label={copy.received} value={formatNumber(data.received, locale)} />
            <OfficeStat tone="info" icon={Phone} label={copy.treated} value={formatNumber(data.treated, locale)} />
            <OfficeStat tone="success" icon={Check} label={copy.confirmed} value={formatNumber(data.confirmed, locale)} />
            <OfficeStat tone={data.cancelled > 0 ? "danger" : "neutral"} icon={CircleAlert} label={copy.cancelled} value={formatNumber(data.cancelled, locale)} />
            <OfficeStat tone={data.unreachable > 0 ? "warning" : "neutral"} icon={PhoneOff} label={copy.unreachable} value={formatNumber(data.unreachable, locale)} />
            <OfficeStat tone="info" icon={Percent} label={copy.rate} value={formatPercent(data.rate, locale)} />
          </div>
          <h2 className="mt-8 font-display text-3xl">{copy.queue}</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {data.queue.map((order) => (
              <li key={order.id} className="flex items-center justify-between py-3 text-sm">
                <Link href={`/confirmer/orders/${order.id}`}>{order.orderNumber}<span className="block text-stone">{order.fullName} · {order.city}</span></Link>
                <span className="flex flex-col items-end gap-1">{formatMoney(order.totalMad, locale)}<StatusPill locale={locale} kind="confirmation" status={order.confirmationStatus} /></span>
              </li>
            ))}
          </ul>
        </>
      ) : <p>{dict.common.empty}</p>}
    </div>
  );
}
