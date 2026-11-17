import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { PrintButton } from "@/components/print-button";
import { StatusPill } from "@/components/office/indicators";
import { addNoteForm, assignOrderForm, transitionOrderAction, updateDeliveryForm, saveShipmentForm } from "@/lib/actions/orders";
import { getI18n } from "@/lib/i18n/server";
import { statusLabel } from "@/lib/i18n";
import { phoneHref } from "@/lib/phone";
import { confirmationStatuses, shipmentStatuses } from "@/lib/orders/transitions";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Carrier, OrderRecord, StaffProfile } from "@/types/commerce";

export async function OrderWorkspace({
  order,
  mode,
  confirmers = [],
  carriers = [],
}: {
  order: OrderRecord;
  mode: "admin" | "confirmer";
  confirmers?: StaffProfile[];
  carriers?: Carrier[];
}) {
  const { locale, dict } = await getI18n();
  const name = locale === "ar" ? "nameAr" : "nameFr";
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-champagne">{order.orderNumber}</p>
          <h1 className="mt-2 font-display text-5xl">{order.fullName}</h1>
          <p className="mt-2 text-sm text-stone">{formatDate(order.createdAt, locale)}</p>
        </div>
        <PrintButton label={dict.common.print} />
      </div>
      <div className="no-print flex flex-wrap gap-2 text-sm">
        <StatusPill locale={locale} kind="confirmation" status={order.confirmationStatus} />
        <StatusPill locale={locale} kind="shipment" status={order.shipmentStatus} />
        <StatusPill locale={locale} kind="payment" status={order.paymentStatus} />
      </div>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="border border-line bg-ivory p-5">
          <h2 className="font-display text-3xl">{dict.admin.orders.customer}</h2>
          <p className="mt-4">{order.fullName}</p>
          <p><a href={phoneHref(order.phone)}>{order.phone}</a></p>
          <p>{order.city}</p>
          <p>{order.address}</p>
          {order.customerNotes ? <p className="mt-3 text-sm text-stone">{dict.admin.orders.customerNotes}: {order.customerNotes}</p> : null}
          {mode === "confirmer" ? <a className="btn btn-primary mt-4" href={phoneHref(order.phone)}>{dict.confirmer.orders.call}</a> : null}
          {mode === "confirmer" ? <p className="mt-4 text-xs text-stone">{dict.confirmer.orders.forbiddenPrice}</p> : null}
        </article>
        <article className="border border-line bg-ivory p-5">
          <h2 className="font-display text-3xl">{dict.admin.orders.amounts}</h2>
          <p className="mt-4 flex justify-between"><span>{dict.admin.orders.subtotal}</span><span>{formatMoney(order.subtotalMad, locale)}</span></p>
          <p className="mt-2 flex justify-between"><span>{dict.admin.orders.shipping}</span><span>{formatMoney(order.shippingFeeMad, locale)}</span></p>
          <p className="mt-3 flex justify-between border-t border-line pt-3"><span>{dict.common.total}</span><span>{formatMoney(order.totalMad, locale)}</span></p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone">{dict.admin.orders.payment}<StatusPill locale={locale} kind="payment" status={order.paymentStatus} /></div>
        </article>
      </section>
      <div className="overflow-x-auto border border-line bg-ivory">
        <table className="data">
          <thead><tr><th>{dict.admin.orders.items}</th><th>SKU</th><th>{dict.common.quantity}</th><th>{dict.common.price}</th><th>{dict.common.total}</th></tr></thead>
          <tbody>
            {(order.items ?? []).map((item) => (
              <tr key={item.id}>
                <td>{item[name]} {item.variantLabel ? `· ${item.variantLabel}` : ""}</td>
                <td>{item.sku}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitPriceMad, locale)}</td>
                <td>{formatMoney(item.lineTotalMad, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={updateDeliveryForm} className="grid gap-3 border border-line bg-ivory p-5 md:grid-cols-2">
        <input type="hidden" name="orderId" value={order.id} />
        <label className="grid gap-2 text-sm">{dict.common.city}<input className="field" name="city" defaultValue={order.city} /></label>
        <label className="grid gap-2 text-sm md:col-span-2">{dict.common.address}<textarea className="field" name="address" defaultValue={order.address} /></label>
        {mode === "admin" ? <label className="grid gap-2 text-sm">{dict.admin.orders.manualShipping}<input className="field" name="manualShipping" type="number" step="0.01" placeholder={String(order.shippingFeeMad)} /></label> : null}
        <button className="btn btn-ghost md:col-span-2 md:w-fit" type="submit">{dict.admin.orders.saveDelivery}</button>
      </form>
      {mode === "admin" ? (
        <form action={assignOrderForm} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="orderId" value={order.id} />
          <label className="grid gap-2 text-sm">{dict.admin.orders.confirmer}
            <select className="field" name="confirmerId" defaultValue={order.assignedConfirmerId ?? ""}>
              <option value="">{dict.admin.orders.unassigned}</option>
              {confirmers.filter((person) => person.isActive).map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" type="submit">{dict.admin.orders.assign}</button>
        </form>
      ) : null}
      <div className="no-print flex flex-wrap gap-2">
        {confirmationStatuses.filter((status) => status !== order.confirmationStatus).map((status) => (
          <ConfirmButton
            key={status}
            action={transitionOrderAction}
            fields={{ orderId: order.id, kind: "confirmation", to: status }}
            label={statusLabel(locale, "confirmation", status)}
            title={dict.dialog.confirmTitle}
            body={dict.dialog.confirmBody}
          />
        ))}
      </div>
      {mode === "admin" ? (
        <form action={saveShipmentForm} className="grid gap-3 border border-line bg-ivory p-5 md:grid-cols-3">
          <input type="hidden" name="orderId" value={order.id} />
          <select className="field" name="carrierId" defaultValue="">
            <option value="">{dict.admin.shipments.carrier}</option>
            {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}
          </select>
          <input className="field" name="tracking" placeholder={dict.admin.shipments.tracking} defaultValue={order.trackingNumber ?? ""} />
          <select className="field" name="status" defaultValue={order.shipmentStatus}>
            {shipmentStatuses.map((status) => <option key={status} value={status}>{statusLabel(locale, "shipment", status)}</option>)}
          </select>
          <input className="field" type="datetime-local" name="shippedAt" />
          <input className="field" type="number" step="0.01" name="carrierFee" placeholder={dict.admin.shipments.carrierFee} defaultValue={order.carrierFeeMad ?? ""} />
          <button className="btn btn-primary" type="submit">{dict.admin.shipments.apply}</button>
        </form>
      ) : null}
      <form action={addNoteForm} className="grid gap-3">
        <input type="hidden" name="orderId" value={order.id} />
        <textarea className="field min-h-24" name="body" placeholder={dict.admin.orders.internal} />
        <button className="btn btn-ghost w-fit" type="submit">{dict.admin.orders.addNote}</button>
      </form>
      <ul className="grid gap-2 text-sm">
        {(order.notes ?? []).map((note) => <li key={note.id} className="border border-line p-3"><strong>{note.authorName}</strong> · {formatDate(note.createdAt, locale)}<p>{note.body}</p></li>)}
      </ul>
      <section>
        <h2 className="font-display text-3xl">{dict.admin.orders.timeline}</h2>
        <ol className="mt-4 grid gap-3">
          {(order.history ?? []).map((entry) => (
            <li key={entry.id} className="border-s border-champagne ps-4">
              <p className="flex flex-wrap items-center gap-2 text-sm"><span className="text-stone">{entry.kind}</span>{entry.fromStatus ? <StatusPill locale={locale} kind={entry.kind === "shipment" ? "shipment" : "confirmation"} status={entry.fromStatus} /> : <span>—</span>}<span aria-hidden="true">→</span><StatusPill locale={locale} kind={entry.kind === "shipment" ? "shipment" : "confirmation"} status={entry.toStatus} /></p>
              <p className="text-xs text-stone">{formatDate(entry.createdAt, locale)} {entry.note ?? ""}</p>
            </li>
          ))}
        </ol>
      </section>
      <Link className="text-sm no-print" href={mode === "admin" ? "/admin/orders" : "/confirmer/orders"}>{dict.common.back}</Link>
    </div>
  );
}
