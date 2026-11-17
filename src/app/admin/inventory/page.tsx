import { adjustStockForm } from "@/lib/actions/orders";
import { StatePill, StockPill } from "@/components/office/indicators";
import { PageIntro } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n/server";
import { listInventory } from "@/lib/services/orders";
import { formatDate } from "@/lib/utils";

export default async function InventoryPage() {
  const { locale, dict } = await getI18n();
  const inventory = await listInventory();
  const copy = dict.admin.inventory;
  return (
    <div>
      <PageIntro title={copy.title} body={copy.lead} />
      <div className="overflow-x-auto border border-line bg-ivory">
        <table className="data">
          <thead><tr><th>{copy.product}</th><th>SKU</th><th>{copy.variant}</th><th>{copy.available}</th><th></th></tr></thead>
          <tbody>
            {inventory.data.map((row) => (
              <tr key={row.id}>
                <td>{row.productName}{row.isActive ? null : <span className="mt-1 block"><StatePill active={false} activeLabel={dict.common.active} inactiveLabel={dict.common.inactive} /></span>}</td>
                <td>{row.sku}</td>
                <td>{row.label || "—"}</td>
                <td><StockPill quantity={row.stockQuantity} threshold={row.threshold} labels={{ ok: dict.office.stockOk, low: dict.office.stockLow, critical: dict.office.stockCritical, out: dict.office.stockOut }} /></td>
                <td>
                  <form action={adjustStockForm} className="flex gap-2">
                    <input type="hidden" name="variantId" value={row.id} />
                    <input className="field w-24" type="number" name="delta" placeholder="+/-" required />
                    <select className="field" name="reason">
                      <option value="restock">{copy.reasons.restock}</option>
                      <option value="adjustment">{copy.reasons.adjustment}</option>
                      <option value="correction">{copy.reasons.correction}</option>
                    </select>
                    <button className="btn btn-ghost" type="submit">{copy.adjust}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-8 font-display text-3xl">{copy.movements}</h2>
      <ul className="mt-4 grid gap-2 text-sm">
        {inventory.movements.map((movement) => (
          <li key={movement.id} className="flex justify-between gap-3 border-b border-line py-2"><span>{movement.reason} · <span className={movement.delta > 0 ? "text-office-success" : movement.delta < 0 ? "text-office-danger" : "text-stone"}>{movement.delta > 0 ? "+" : ""}{movement.delta}</span></span><span>{formatDate(movement.createdAt, locale)}</span></li>
        ))}
      </ul>
    </div>
  );
}
