import { saveCarrierForm } from "@/lib/actions/orders";
import { StatePill } from "@/components/office/indicators";
import { PageIntro } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { listCarriers } from "@/lib/services/settings";

export default async function CarriersPage() {
  const { dict } = await getI18n();
  const carriers = await listCarriers();
  const copy = dict.admin.carriers;
  return (
    <div>
      <PageIntro title={copy.title} body={copy.lead} />
      <form action={saveCarrierForm} className="mb-8 grid gap-3 border border-line bg-ivory p-5 md:grid-cols-2">
        <input className="field" name="name" placeholder={copy.name} required />
        <input className="field" name="phone" placeholder={copy.phone} />
        <textarea className="field md:col-span-2" name="notes" placeholder={copy.notes} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked />{dict.common.active}</label>
        <button className="btn btn-primary w-fit" type="submit">{copy.new}</button>
      </form>
      <div className="grid gap-3">
        {carriers.data.map((carrier) => (
          <form key={carrier.id} action={saveCarrierForm} className="grid gap-3 border border-line bg-ivory p-4 md:grid-cols-4">
            <div className="md:col-span-4"><StatePill active={carrier.isActive} activeLabel={dict.common.active} inactiveLabel={dict.common.inactive} /></div>
            <input type="hidden" name="id" value={carrier.id} />
            <input className="field" name="name" defaultValue={carrier.name} />
            <input className="field" name="phone" defaultValue={carrier.phone} />
            <input className="field" name="notes" defaultValue={carrier.notes} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={carrier.isActive} />{dict.common.active}</label>
            <button className="btn btn-ghost w-fit" type="submit">{dict.common.save}</button>
          </form>
        ))}
      </div>
    </div>
  );
}
