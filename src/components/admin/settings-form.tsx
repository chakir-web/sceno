"use client";

import { useState } from "react";
import { saveSettings } from "@/lib/actions/catalog";
import { Notice } from "@/components/office/indicators";
import { useI18n } from "@/components/providers";
import type { ShippingRate, StoreSettings } from "@/types/commerce";

export function SettingsForm({ settings, rates }: { settings: StoreSettings; rates: ShippingRate[] }) {
  const { dict } = useI18n();
  const copy = dict.admin.settings;
  const [rows, setRows] = useState(rates.map((rate) => ({ city: rate.city, feeMad: rate.feeMad, zone: rate.zone, isActive: rate.isActive })));
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("rates", JSON.stringify(rows));
        const result = await saveSettings(formData);
        setMessage(result.ok ? { tone: "success", text: dict.toast.saved } : { tone: "danger", text: dict.errors[result.code as keyof typeof dict.errors] ?? dict.errors.generic });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm">{copy.storeName}<input className="field" name="storeName" defaultValue={settings.storeName} /></label>
        <label className="grid gap-2 text-sm">{copy.phone}<input className="field" name="phone" defaultValue={settings.supportPhone} /></label>
        <label className="grid gap-2 text-sm">{copy.email}<input className="field" name="email" defaultValue={settings.supportEmail} /></label>
        <label className="grid gap-2 text-sm">{copy.address}<input className="field" name="address" defaultValue={settings.address} /></label>
        <label className="grid gap-2 text-sm">{copy.defaultLocale}
          <select className="field" name="defaultLocale" defaultValue={settings.defaultLocale}><option value="fr">FR</option><option value="ar">AR</option></select>
        </label>
        <label className="grid gap-2 text-sm">{copy.defaultFee}<input className="field" name="defaultFee" type="number" step="0.01" defaultValue={settings.defaultShippingFeeMad} /></label>
        <label className="grid gap-2 text-sm">{copy.instagram}<input className="field" name="instagram" defaultValue={settings.instagram} /></label>
        <label className="grid gap-2 text-sm">{copy.facebook}<input className="field" name="facebook" defaultValue={settings.facebook} /></label>
        <label className="grid gap-2 text-sm md:col-span-2">{copy.aboutFr}<textarea className="field min-h-28" name="aboutFr" defaultValue={settings.aboutFr} /></label>
        <label className="grid gap-2 text-sm md:col-span-2">{copy.aboutAr}<textarea className="field min-h-28" dir="rtl" name="aboutAr" defaultValue={settings.aboutAr} /></label>
        <label className="grid gap-2 text-sm">{copy.logo}<input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
        <p className="self-end text-sm text-stone">{copy.currencyLocked}</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl">{copy.rates}</h2>
          <button type="button" className="btn btn-ghost" onClick={() => setRows((current) => [...current, { city: "", feeMad: settings.defaultShippingFeeMad, zone: "", isActive: true }])}>{copy.addCity}</button>
        </div>
        <div className="mt-4 grid gap-3">
          {rows.map((row, index) => (
            <div key={`${row.city}-${index}`} className="grid gap-2 md:grid-cols-4">
              <input className="field" value={row.city} placeholder={dict.common.city} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, city: event.target.value } : item))} />
              <input className="field" type="number" value={row.feeMad} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, feeMad: Number(event.target.value) } : item))} />
              <input className="field" value={row.zone} placeholder={copy.zone} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, zone: event.target.value } : item))} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.isActive} onChange={(event) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, isActive: event.target.checked } : item))} />{dict.common.active}</label>
            </div>
          ))}
        </div>
      </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <button className="btn btn-primary w-fit" type="submit">{dict.common.save}</button>
    </form>
  );
}
