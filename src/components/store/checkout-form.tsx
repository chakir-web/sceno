"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCart, useI18n } from "@/components/providers";
import type { Quote } from "@/lib/services/checkout";
import { formatMoney } from "@/lib/utils";

const formSchema = z.object({
  fullName: z.string().trim().min(3),
  phone: z.string().trim().min(8),
  address: z.string().trim().min(5),
  notes: z.string().trim().max(500).optional(),
});

export function CheckoutForm({ cities, defaultCity }: { cities: { city: string; feeMad: number }[]; defaultCity: string }) {
  const { dict, locale } = useI18n();
  const { items, clear } = useCart();
  const router = useRouter();
  const idempotency = useRef<string>("");
  const [city, setCity] = useState(defaultCity || cities[0]?.city || "__other");
  const [other, setOther] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema), defaultValues: { fullName: "", phone: "", address: "", notes: "" } });
  const resolvedCity = city === "__other" ? other : city;

  useEffect(() => {
    if (!idempotency.current) idempotency.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    if (!items.length || resolvedCity.trim().length < 2) return;
    const controller = new AbortController();
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        city: resolvedCity,
        locale,
        items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
      }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          setQuote(null);
          setError(dict.errors[body.code as keyof typeof dict.errors] ?? dict.checkout.quoteError);
        } else {
          setQuote(body.quote as Quote);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(dict.checkout.quoteError);
      });
    return () => controller.abort();
  }, [items, resolvedCity, locale, dict]);

  if (!items.length) return <p>{dict.checkout.empty}</p>;

  return (
    <form
      className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]"
      onSubmit={form.handleSubmit(async (values) => {
        setPending(true);
        setError("");
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            notes: values.notes ?? "",
            city: resolvedCity,
            locale,
            idempotencyKey: idempotency.current || crypto.randomUUID(),
            items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
          }),
        });
        const body = await response.json();
        setPending(false);
        if (!response.ok) {
          setError(dict.errors[body.code as keyof typeof dict.errors] ?? dict.errors.generic);
          return;
        }
        clear();
        router.push(`/order-success?number=${encodeURIComponent(body.order.order_number)}`);
      })}
    >
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm">{dict.checkout.fullName}<input className="field" {...form.register("fullName")} /></label>
        <label className="grid gap-2 text-sm">{dict.checkout.phone}<input className="field" inputMode="tel" placeholder={dict.checkout.phoneHint} {...form.register("phone")} /></label>
        <label className="grid gap-2 text-sm">{dict.checkout.city}
          <select className="field" value={city} onChange={(event) => setCity(event.target.value)}>
            {cities.map((item) => <option key={item.city} value={item.city}>{item.city}</option>)}
            <option value="__other">{dict.checkout.cityOther}</option>
          </select>
        </label>
        {city === "__other" ? <input className="field" value={other} onChange={(event) => setOther(event.target.value)} placeholder={dict.checkout.city} /> : null}
        <label className="grid gap-2 text-sm">{dict.checkout.address}<textarea className="field min-h-28" {...form.register("address")} /></label>
        <label className="grid gap-2 text-sm">{dict.checkout.notes}<textarea className="field min-h-20" placeholder={dict.checkout.notesHint} {...form.register("notes")} /></label>
        {error ? <p className="text-sm text-red-900">{error}</p> : null}
        <button className="btn btn-primary" disabled={pending || !quote} type="submit">{dict.checkout.submit}</button>
      </div>
      <aside className="h-fit border border-line p-6">
        <h2 className="font-display text-3xl">{dict.checkout.summary}</h2>
        <ul className="mt-4 grid gap-3 text-sm">
          {(quote?.lines ?? items.map((item) => ({ ...item, lineTotalMad: item.unitPrice * item.quantity, unitPriceMad: item.unitPrice }))).map((line) => (
            <li key={`${line.variantId}`} className="flex justify-between gap-3">
              <span>{line.name} × {line.quantity}</span>
              <span>{formatMoney(line.lineTotalMad, locale)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-line pt-4 text-sm"><span>{dict.checkout.shipping}</span><span>{quote ? formatMoney(quote.shippingFeeMad, locale) : dict.checkout.quoting}</span></div>
        <div className="mt-3 flex justify-between text-lg"><span>{dict.checkout.total}</span><span>{quote ? formatMoney(quote.totalMad, locale) : "—"}</span></div>
        <p className="mt-4 text-xs uppercase tracking-[0.14em] text-champagne">{dict.checkout.cod}</p>
      </aside>
    </form>
  );
}
