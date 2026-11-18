"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useI18n } from "@/components/providers";
import { statusLabel } from "@/lib/i18n";
import { asArray, asNumber } from "@/lib/http";
import { formatDate, formatMoney } from "@/lib/utils";

const schema = z.object({ orderNumber: z.string().trim().min(4), phone: z.string().trim().min(8) });

export function TrackForm() {
  const { dict, locale } = useI18n();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          const response = await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
          const body = await response.json();
          if (!response.ok) {
            setOrder(null);
            setError(dict.errors[body.code as keyof typeof dict.errors] ?? dict.track.notFound);
            return;
          }
          setOrder(body.order);
        })}
      >
        <label className="grid gap-2 text-sm">{dict.track.number}<input className="field" {...form.register("orderNumber")} /></label>
        <label className="grid gap-2 text-sm">{dict.track.phone}<input className="field" {...form.register("phone")} /></label>
        {error ? <p className="text-sm text-red-900">{error}</p> : null}
        <button className="btn btn-primary" type="submit">{dict.track.submit}</button>
      </form>
      {order ? (
        <article className="border border-line p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-champagne">{String(order.order_number)}</p>
          <p className="mt-2 text-sm text-stone">{dict.track.date}: {formatDate(String(order.created_at), locale)}</p>
          <ul className="mt-4 grid gap-2 text-sm">
            {asArray<Record<string, unknown>>(order.items).map((item, index) => (
              <li key={index} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <span className="min-w-0 break-words">{locale === "ar" ? String(item.name_ar) : String(item.name_fr)} {item.variant_label ? `· ${String(item.variant_label)}` : ""} × {String(item.quantity)}</span>
                <span className="shrink-0">{formatMoney(asNumber(item.line_total_mad), locale)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4">{dict.track.amount}: {formatMoney(asNumber(order.total_mad), locale)}</p>
          <p className="mt-2 text-sm">{dict.track.confirmation}: {statusLabel(locale, "confirmation", String(order.confirmation_status))}</p>
          <p className="mt-1 text-sm">{dict.track.shipment}: {statusLabel(locale, "shipment", String(order.shipment_status))}</p>
          <p className="mt-1 text-sm">{dict.track.carrier}: {order.carrier_name ? String(order.carrier_name) : dict.track.pendingCarrier}</p>
          <p className="mt-1 break-all text-sm">{dict.track.tracking}: {order.tracking_number ? String(order.tracking_number) : dict.track.noTracking}</p>
          <p className="mt-1 text-sm">{dict.track.ozoneStatus}: {order.ozone_status_label || order.ozone_status ? String(order.ozone_status_label || order.ozone_status) : "—"}</p>
          {order.ozone_status || order.ozone_status_label ? <p className="mt-1 text-sm text-stone">{dict.track.unmapped}</p> : null}
          <p className="mt-1 text-sm">{dict.track.updated}: {order.ozone_last_event_at ? formatDate(String(order.ozone_last_event_at), locale) : "—"}</p>
          <p className="mt-1 text-sm">{dict.track.synced}: {order.ozone_synced_at ? formatDate(String(order.ozone_synced_at), locale) : "—"}</p>
          <h3 className="mt-6 font-display text-2xl">{dict.track.timeline}</h3>
          <ol className="mt-3 grid gap-2">
            {asArray<Record<string, unknown>>(order.history).map((entry, index) => {
              const kind = String(entry.kind);
              const labelKind = kind === "shipment" ? "shipment" : "confirmation";
              return (
                <li key={index} className="border-s border-champagne ps-3 text-sm">
                  <span>{kind === "shipment" ? dict.track.shipment : dict.track.confirmation}</span>
                  {" "}
                  {entry.from_status ? statusLabel(locale, labelKind, String(entry.from_status)) : "—"}
                  {" → "}
                  {statusLabel(locale, labelKind, String(entry.to_status))}
                  <span className="block text-stone">{formatDate(String(entry.created_at), locale)}</span>
                </li>
              );
            })}
          </ol>
        </article>
      ) : null}
    </div>
  );
}
