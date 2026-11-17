import { Banknote, Check, CircleAlert, PackageCheck, ShoppingBag, Truck, Undo2, Wallet } from "lucide-react";
import { OrdersChart } from "@/components/admin/charts";
import { OfficeStat } from "@/components/office/indicators";
import { PageIntro } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { getAdminReports } from "@/lib/services/dashboard";
import { formatMoney, formatNumber, formatPercent } from "@/lib/utils";

function casablancaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const today = casablancaToday();
  const startDate = new Date(`${today}T12:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 30);
  const from = params.from || startDate.toISOString().slice(0, 10);
  const to = params.to || today;
  const { locale, dict } = await getI18n();
  const report = await getAdminReports(from, to);
  const copy = dict.admin.reports;
  const data = report.data;
  return (
    <div>
      <PageIntro title={copy.title} body={copy.lead} action={<a className="btn btn-ghost" href={`/api/admin/reports/export?from=${from}&to=${to}`}>{copy.export}</a>} />
      <form className="mb-6 flex flex-wrap gap-3">
        <input className="field" type="date" name="from" defaultValue={from} />
        <input className="field" type="date" name="to" defaultValue={to} />
        <button className="btn btn-primary" type="submit">{dict.common.apply}</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OfficeStat tone="info" icon={ShoppingBag} label={copy.created} value={formatNumber(data.created, locale)} />
        <OfficeStat tone="success" icon={Check} label={copy.confirmed} value={formatNumber(data.confirmed, locale)} hint={formatMoney(data.confirmedAmount, locale)} />
        <OfficeStat tone="success" icon={PackageCheck} label={copy.delivered} value={formatNumber(data.delivered, locale)} />
        <OfficeStat tone="success" icon={Banknote} label={copy.collected} value={formatMoney(data.collected, locale)} />
        <OfficeStat tone="info" icon={Truck} label={copy.shippingCharged} value={formatMoney(data.shippingCharged, locale)} />
        <OfficeStat tone="neutral" icon={Wallet} label={copy.carrierFees} value={formatMoney(data.carrierFees, locale)} />
        <OfficeStat tone={data.cancelled > 0 ? "danger" : "neutral"} icon={CircleAlert} label={copy.cancelled} value={formatNumber(data.cancelled, locale)} />
        <OfficeStat tone={data.refused > 0 ? "danger" : "neutral"} icon={CircleAlert} label={copy.refused} value={formatNumber(data.refused, locale)} />
        <OfficeStat tone={data.returned > 0 ? "danger" : "neutral"} icon={Undo2} label={copy.returned} value={formatNumber(data.returned, locale)} />
      </div>
      <div className="mt-6"><OrdersChart data={data.byDay.map((row) => ({ day: row.period, orders: row.orders, collected: row.collected }))} label={copy.day} /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-3xl">{copy.week}</h2>
          <PeriodTable rows={data.byWeek} ordersLabel={copy.orders} amountLabel={copy.amount} locale={locale} />
          <h2 className="mt-6 font-display text-3xl">{copy.month}</h2>
          <PeriodTable rows={data.byMonth} ordersLabel={copy.orders} amountLabel={copy.amount} locale={locale} />
        </section>
        <section>
          <h2 className="font-display text-3xl">{copy.confirmers}</h2>
          <table className="data mt-3">
            <thead><tr><th>{dict.common.name}</th><th>{dict.admin.confirmers.received}</th><th>{dict.admin.confirmers.rate}</th></tr></thead>
            <tbody>{data.confirmers.map((person) => <tr key={person.id}><td>{person.name}</td><td>{person.received}</td><td>{formatPercent(person.rate, locale)}</td></tr>)}</tbody>
          </table>
          <h2 className="mt-6 font-display text-3xl">{copy.top}</h2>
          <table className="data mt-3">
            <thead><tr><th>{dict.common.name}</th><th>{copy.soldQty}</th><th>{copy.collectedQty}</th></tr></thead>
            <tbody>{data.topProducts.map((product) => <tr key={product.name}><td>{product.name}</td><td>{product.quantity}</td><td>{product.collectedQuantity}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function PeriodTable({ rows, ordersLabel, amountLabel, locale }: { rows: { period: string; orders: number; collected: number }[]; ordersLabel: string; amountLabel: string; locale: "fr" | "ar" }) {
  return (
    <table className="data mt-3">
      <thead><tr><th></th><th>{ordersLabel}</th><th>{amountLabel}</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.period}><td>{row.period}</td><td>{row.orders}</td><td>{formatMoney(row.collected, locale)}</td></tr>)}</tbody>
    </table>
  );
}
