"use client";

import { useState } from "react";
import { importShipments, saveShipmentAction } from "@/lib/actions/orders";
import { Notice, StatusPill } from "@/components/office/indicators";
import { useI18n } from "@/components/providers";
import { shipmentStatuses } from "@/lib/orders/transitions";
import { statusLabel } from "@/lib/i18n";
import { formatMoney } from "@/lib/utils";
import type { Carrier, OrderRecord } from "@/types/commerce";

export function ShipmentBoard({ orders, carriers, ozoneReady }: { orders: OrderRecord[]; carriers: Carrier[]; ozoneReady: boolean }) {
  const { dict, locale } = useI18n();
  const copy = dict.admin.shipments;
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const all = orders.length > 0 && selected.length === orders.length;

  return (
    <div className="grid gap-6">
      <Notice tone="info">{ozoneReady ? copy.ozoneConnected : `${copy.noApi} ${copy.future}`}</Notice>
      <form
        className="grid gap-3 border border-line bg-ivory p-4 md:grid-cols-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const source = new FormData(event.currentTarget);
          let failed = 0;
          for (const orderId of selected) {
            const data = new FormData();
            source.forEach((value, key) => data.set(key, value));
            data.set("orderId", orderId);
            const result = await saveShipmentAction(data);
            if (!result.ok) failed += 1;
          }
          setMessage(failed ? { tone: "danger", text: dict.errors.generic } : { tone: "success", text: dict.toast.saved });
        }}
      >
        <select className="field" name="carrierId" defaultValue="">
          <option value="">{copy.carrier}</option>
          {carriers.filter((carrier) => carrier.isActive).map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}
        </select>
        <input className="field" name="carrierName" placeholder={copy.carrier} />
        <input className="field" name="tracking" placeholder={copy.tracking} />
        <input className="field" type="datetime-local" name="shippedAt" />
        <input className="field" type="number" step="0.01" name="carrierFee" placeholder={copy.carrierFee} />
        <select className="field" name="status" defaultValue="prepared">
          {shipmentStatuses.map((status) => <option key={status} value={status}>{statusLabel(locale, "shipment", status)}</option>)}
        </select>
        <button className="btn btn-primary" type="submit" disabled={!selected.length}>{copy.apply}</button>
        <a className="btn btn-ghost" href={`/api/admin/shipments/export?ids=${selected.join(",")}`}>{copy.export}</a>
      </form>
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await importShipments(new FormData(event.currentTarget));
          setMessage(result.ok ? { tone: "success", text: `${dict.toast.imported} ${result.imported}` } : { tone: "danger", text: dict.errors.generic });
        }}
      >
        <input type="file" name="file" accept=".csv,text/csv" required />
        <button className="btn btn-ghost" type="submit">{copy.import}</button>
        <span className="text-xs text-stone">{copy.importHelp}</span>
      </form>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div className="overflow-x-auto border border-line bg-ivory">
        <table className="data">
          <thead>
            <tr>
              <th><input type="checkbox" checked={all} onChange={(event) => setSelected(event.target.checked ? orders.map((order) => order.id) : [])} aria-label={copy.selectAll} /></th>
              <th>{dict.track.number}</th><th>{dict.common.name}</th><th>{dict.common.city}</th><th>{dict.common.total}</th><th>{dict.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td><input type="checkbox" checked={selected.includes(order.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /></td>
                <td>{order.orderNumber}</td>
                <td>{order.fullName}</td>
                <td>{order.city}</td>
                <td>{formatMoney(order.totalMad, locale)}</td>
                <td><StatusPill locale={locale} kind="shipment" status={order.shipmentStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
