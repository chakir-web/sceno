import Link from "next/link";
import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getCustomer } from "@/lib/services/orders";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { locale, dict } = await getI18n();
  const customer = await getCustomer(id);
  if (!customer.data) notFound();
  return (
    <div>
      <h1 className="font-display text-5xl">{customer.data.fullName}</h1>
      <p className="mt-3 text-sm">{customer.data.phone} · {customer.data.city}</p>
      <p className="text-sm">{customer.data.address}</p>
      <p className="mt-2 text-sm text-stone">{dict.admin.customers.since} {formatDate(customer.data.createdAt, locale, false)} · {formatMoney(customer.data.totalMad, locale)}</p>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {customer.orders.map((order) => (
          <li key={order.id} className="flex justify-between py-3 text-sm">
            <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>
            <span>{formatMoney(order.totalMad, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
