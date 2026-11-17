import Link from "next/link";
import { PageIntro } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { listCustomers } from "@/lib/services/orders";
import { formatMoney } from "@/lib/utils";

export default async function CustomersPage() {
  const { locale, dict } = await getI18n();
  const customers = await listCustomers();
  return (
    <div>
      <PageIntro title={dict.admin.customers.title} />
      <div className="overflow-x-auto border border-line bg-ivory">
        <table className="data">
          <thead><tr><th>{dict.common.name}</th><th>{dict.common.phone}</th><th>{dict.common.city}</th><th>{dict.admin.customers.orders}</th><th>{dict.admin.customers.spent}</th></tr></thead>
          <tbody>
            {customers.data.map((customer) => (
              <tr key={customer.id}>
                <td><Link href={`/admin/customers/${customer.id}`}>{customer.fullName}</Link></td>
                <td>{customer.phone}</td>
                <td>{customer.city}</td>
                <td>{customer.orderCount}</td>
                <td>{formatMoney(customer.totalMad, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!customers.data.length ? <p className="mt-4 text-sm">{dict.admin.customers.empty}</p> : null}
    </div>
  );
}
