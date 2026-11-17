import Link from "next/link";
import { createConfirmerForm } from "@/lib/actions/auth";
import { StatePill } from "@/components/office/indicators";
import { PageIntro } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { confirmerStats } from "@/lib/services/orders";
import { formatPercent } from "@/lib/utils";

export default async function ConfirmersPage() {
  const { locale, dict } = await getI18n();
  const people = await confirmerStats();
  const copy = dict.admin.confirmers;
  return (
    <div>
      <PageIntro title={copy.title} />
      <form action={createConfirmerForm} className="mb-8 grid gap-3 border border-line bg-ivory p-5 md:grid-cols-2">
        <h2 className="font-display text-3xl md:col-span-2">{copy.create}</h2>
        <input className="field" name="fullName" placeholder={copy.fullName} required />
        <input className="field" name="phone" placeholder={copy.phone} />
        <input className="field" type="email" name="email" placeholder={copy.email} required />
        <input className="field" type="password" name="password" minLength={10} placeholder={copy.password} required />
        <button className="btn btn-primary w-fit" type="submit">{copy.create}</button>
      </form>
      <div className="overflow-x-auto border border-line bg-ivory">
        <table className="data">
          <thead><tr><th>{dict.common.name}</th><th>{copy.received}</th><th>{copy.confirmed}</th><th>{copy.cancelled}</th><th>{copy.unreachable}</th><th>{copy.rate}</th><th>{dict.common.status}</th></tr></thead>
          <tbody>
            {people.data.map((person) => (
              <tr key={person.id}>
                <td><Link href={`/admin/confirmers/${person.id}`}>{person.fullName}</Link></td>
                <td>{person.received}</td>
                <td>{person.confirmed}</td>
                <td>{person.cancelled}</td>
                <td>{person.unreachable}</td>
                <td>{formatPercent(person.rate, locale)}</td>
                <td><StatePill active={person.isActive} activeLabel={dict.common.active} inactiveLabel={dict.common.inactive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
