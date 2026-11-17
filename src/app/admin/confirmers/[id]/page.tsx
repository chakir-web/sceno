import { notFound } from "next/navigation";
import { updateConfirmerForm } from "@/lib/actions/auth";
import { StatePill, StatusPill } from "@/components/office/indicators";
import { getI18n } from "@/lib/i18n/server";
import { confirmerStats, listOrders } from "@/lib/services/orders";
import { formatMoney, formatPercent } from "@/lib/utils";
import Link from "next/link";

export default async function ConfirmerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, dict } = await getI18n();
  const people = await confirmerStats();
  const person = people.data.find((item) => item.id === id);
  if (!person) notFound();
  const orders = await listOrders({ assignedTo: id });
  const copy = dict.admin.confirmers;
  return (
    <div>
      <h1 className="font-display text-5xl">{person.fullName}</h1>
      <div className="mt-3"><StatePill active={person.isActive} activeLabel={dict.common.active} inactiveLabel={dict.common.inactive} /></div>
      <p className="mt-3 text-sm">{copy.rate}: {formatPercent(person.rate, locale)} · {copy.received}: {person.received}</p>
      <form action={updateConfirmerForm} className="mt-6 grid max-w-xl gap-3">
        <input type="hidden" name="id" value={person.id} />
        <input className="field" name="fullName" defaultValue={person.fullName} />
        <input className="field" name="phone" defaultValue={person.phone ?? ""} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={person.isActive} />{copy.active}</label>
        <button className="btn btn-primary w-fit" type="submit">{copy.save}</button>
      </form>
      <ul className="mt-8 divide-y divide-line">
        {orders.data.items.map((order) => (
          <li key={order.id} className="flex justify-between py-3 text-sm">
            <Link href={`/admin/orders/${order.id}`}>{order.orderNumber} · {order.fullName}</Link>
            <span className="flex flex-col items-end gap-1">{formatMoney(order.totalMad, locale)}<StatusPill locale={locale} kind="confirmation" status={order.confirmationStatus} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
