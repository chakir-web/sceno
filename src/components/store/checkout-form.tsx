"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCart, useI18n } from "@/components/providers";
import { CitySelect } from "@/components/store/city-select";
import { trackMeta } from "@/lib/meta/pixel";
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

  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!idempotency.current) idempotency.current = crypto.randomUUID();
  }, []);
  useEffect(() => {
    if (checkoutTracked.current || !items.length) return;
    checkoutTracked.current = true;
    trackMeta("InitiateCheckout", {
      content_ids: items.map((item) => item.productId),
      content_type: "product",
      contents: items.map((item) => ({ id: item.productId, quantity: item.quantity, item_price: item.unitPrice })),
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      value: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      currency: "MAD",
    });
  }, [items]);

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
        const order = body.order as { order_number: string; total_mad: number };
        trackMeta("Purchase", {
          content_ids: items.map((item) => item.productId),
          content_type: "product",
          contents: items.map((item) => ({ id: item.productId, quantity: item.quantity, item_price: item.unitPrice })),
          num_items: items.reduce((sum, item) => sum + item.quantity, 0),
          value: Number(order.total_mad ?? quote?.totalMad ?? 0),
          currency: "MAD",
        }, order.order_number);
        clear();
        router.push(`/order-success?number=${encodeURIComponent(order.order_number)}`);
      })}
    >
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm">{dict.checkout.fullName}<input className="field" {...form.register("fullName")} /></label>
        <label className="grid gap-2 text-sm">{dict.checkout.phone}<input className="field" inputMode="tel" placeholder={dict.checkout.phoneHint} {...form.register("phone")} /></label>
        <div className="grid gap-2 text-sm">
          <label htmlFor="checkout-city">{dict.checkout.city}</label>
          <CitySelect id="checkout-city" cities={cities} value={city} onChange={setCity} />
        </div>
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
