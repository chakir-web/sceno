"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useI18n } from "@/components/providers";
import { CitySelect } from "@/components/store/city-select";
import { useProductColor } from "@/components/store/product-color";
import { trackMeta } from "@/lib/meta/pixel";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { unitPrice } from "@/lib/pricing";
import { catalogContentId, tiktokCommerce, type TikTokCommerce } from "@/lib/tiktok/commerce";
import { reportTikTok, trackTikTok } from "@/lib/tiktok/pixel";
import type { Quote } from "@/lib/services/checkout";
import { formatMoney } from "@/lib/utils";
import type { CatalogProduct } from "@/types/commerce";

const formSchema = z.object({
  firstName: z.string().trim().min(2, "name"),
  lastName: z.string().trim().min(2, "name"),
  phone: z.string().trim().min(8, "phone").refine((value) => normalizeMoroccanPhone(value) !== null, { message: "phone" }),
  address: z.string().trim().min(5, "address"),
});

type FormValues = z.infer<typeof formSchema>;

type Confirmation = {
  number: string;
  total: number;
  quantity: number;
  city: string;
  name: string;
};

function benefitLines(description: string) {
  return description
    .split(/\n+|(?<=[.!؟])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 12)
    .slice(0, 4);
}

export function DirectOrder({
  product,
  cities,
  defaultCity,
}: {
  product: CatalogProduct;
  cities: { city: string; feeMad: number }[];
  defaultCity: string;
}) {
  const { dict, locale } = useI18n();
  const setColor = useProductColor()?.setColor;
  const variants = product.variants.filter((variant) => variant.isActive);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [city, setCity] = useState(defaultCity || cities[0]?.city || "__other");
  const [other, setOther] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [cityError, setCityError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Confirmation | null>(null);
  const idempotency = useRef("");
  const started = useRef(false);
  const sending = useRef(false);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { firstName: "", lastName: "", phone: "", address: "" } });
  const variant = variants.find((item) => item.id === variantId) ?? variants[0];
  const price = variant ? unitPrice(product.priceMad, product.promoPriceMad, variant.priceMad) : 0;
  const sizes = useMemo(() => Array.from(new Set(variants.map((item) => item.size).filter(Boolean))), [variants]);
  const colors = useMemo(() => variants.filter((item) => !variant?.size || item.size === variant.size), [variant, variants]);
  const resolvedCity = city === "__other" ? other.trim() : city;
  const benefits = useMemo(() => benefitLines(product.description), [product.description]);
  const orderedQuantity = Math.min(quantity, variant?.stockQuantity ?? 1, 20);

  useEffect(() => {
    if (!idempotency.current) idempotency.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    setColor?.(variant?.color ?? null);
  }, [setColor, variant?.color]);

  useEffect(() => {
    if (!variant || resolvedCity.length < 2) return;
    setQuote(null);
    const controller = new AbortController();
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        city: resolvedCity,
        locale,
        items: [{ productId: product.id, variantId: variant.id, quantity: orderedQuantity }],
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
  }, [dict, locale, orderedQuantity, product.id, resolvedCity, variant]);

  function fieldMessage(name: keyof FormValues) {
    const code = form.formState.errors[name]?.message;
    if (code === "phone") return dict.errors.invalid_phone;
    if (code === "address") return dict.errors.invalid_address;
    if (code === "name") return dict.direct.required;
    if (code) return dict.direct.required;
    return "";
  }

  function beginCheckout() {
    if (started.current || !variant) return;
    started.current = true;
    const value = price * orderedQuantity;
    const commerce = tiktokCommerce(
      [{ id: catalogContentId(product, variant), name: product.name, quantity: orderedQuantity, price }],
      value,
      product.categoryName ?? undefined,
    );
    trackMeta("InitiateCheckout", {
      content_ids: [product.id],
      content_type: "product",
      contents: [{ id: product.id, quantity: orderedQuantity, item_price: price }],
      num_items: orderedQuantity,
      value,
      currency: "MAD",
    });
    reportTikTok("InitiateCheckout", commerce, crypto.randomUUID());
  }

  async function submit(values: FormValues) {
    if (sending.current || done || !variant) return;
    sending.current = true;
    if (resolvedCity.length < 2) {
      setCityError(dict.errors.invalid_city);
      return;
    }
    beginCheckout();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: `${values.firstName.trim()} ${values.lastName.trim()}`,
          phone: values.phone,
          address: values.address,
          notes: "",
          city: resolvedCity,
          locale,
          idempotencyKey: idempotency.current || crypto.randomUUID(),
          items: [{ productId: product.id, variantId: variant.id, quantity: orderedQuantity }],
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.order) {
        setError(dict.errors[body?.code as keyof typeof dict.errors] ?? dict.errors.generic);
        return;
      }
      const order = body.order as { order_number: string; total_mad: number; replayed?: boolean };
      const tracked = body.tiktok as (TikTokCommerce & { eventId?: string }) | undefined;
      const purchase = !order.replayed && tracked?.eventId === order.order_number && tracked.content_id
        ? tracked
        : !order.replayed
          ? tiktokCommerce(
            [{ id: catalogContentId(product, variant), name: product.name, quantity: orderedQuantity, price }],
            Number(order.total_mad ?? quote?.totalMad ?? 0),
            product.categoryName ?? undefined,
          )
          : null;
      if (purchase) {
        trackMeta("Purchase", {
          content_ids: [product.id],
          content_type: "product",
          contents: [{ id: product.id, quantity: orderedQuantity, item_price: price }],
          num_items: orderedQuantity,
          value: Number(order.total_mad ?? quote?.totalMad ?? 0),
          currency: "MAD",
        }, order.order_number);
        trackTikTok("Purchase", purchase, order.order_number);
      }
      setDone({
        number: order.order_number,
        total: Number(order.total_mad ?? quote?.totalMad ?? 0),
        quantity: orderedQuantity,
        city: resolvedCity,
        name: product.name,
      });
    } catch {
      setError(dict.errors.generic);
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  if (!variant) return <p className="text-sm">{dict.product.unavailable}</p>;

  if (done) {
    return (
      <div className="grid gap-4 border border-line p-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-champagne">SCENO</p>
        <h2 className="font-display text-4xl">{dict.direct.confirmed}</h2>
        <p className="text-sm leading-6 text-stone">{dict.direct.thanks}</p>
        <p className="font-display text-3xl">{done.number}</p>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-3"><dt>{dict.direct.product}</dt><dd>{done.name}</dd></div>
          <div className="flex justify-between gap-3"><dt>{dict.direct.quantity}</dt><dd>{done.quantity}</dd></div>
          <div className="flex justify-between gap-3"><dt>{dict.checkout.city}</dt><dd>{done.city}</dd></div>
          <div className="flex justify-between gap-3 text-base"><dt>{dict.direct.total}</dt><dd>{formatMoney(done.total, locale)}</dd></div>
        </dl>
        <p className="text-xs uppercase tracking-[0.14em] text-champagne">{dict.checkout.cod}</p>
        <Link className="btn btn-ghost" href="/">{dict.direct.continue}</Link>
      </div>
    );
  }

  const submitButton = (
    <button className="btn btn-primary w-full min-h-12" disabled={pending || !quote || variant.stockQuantity < 1} type="submit">
      {pending ? dict.direct.ordering : dict.direct.order}
    </button>
  );

  return (
    <div className="grid gap-6 pb-24 md:pb-0">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-champagne">{product.categoryName}</p>
        <h1 className="mt-3 font-display text-5xl">{product.name}</h1>
        <p className="mt-4 font-display text-5xl">{formatMoney(price, locale)}</p>
        {price < product.priceMad ? <p className="text-sm text-stone line-through">{formatMoney(product.priceMad, locale)}</p> : null}
        {product.shortDescription ? <p className="mt-4 max-w-xl text-sm leading-7 text-stone">{product.shortDescription}</p> : null}
      </div>
      {benefits.length ? (
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-stone">{dict.direct.advantages}</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6">
            {benefits.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      ) : null}
      {sizes.length > 0 ? (
        <label className="grid gap-2 text-sm">
          {dict.product.size}
          <select className="field" value={variant.size ?? ""} onChange={(event) => {
            const next = variants.find((item) => item.size === event.target.value);
            if (next) setVariantId(next.id);
          }}>
            {sizes.map((size) => <option key={size} value={size ?? ""}>{size}</option>)}
          </select>
        </label>
      ) : null}
      {colors.some((item) => item.color) ? (
        <div>
          <p className="text-sm">{dict.product.color}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((item) => (
              <button key={item.id} type="button" className={`border px-3 py-2 text-sm ${item.id === variant.id ? "border-ink" : "border-line"}`} onClick={() => setVariantId(item.id)}>
                <span className="me-2 inline-block h-3 w-3" style={{ background: item.colorHex || "#C6B69B" }} />
                {item.color}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <span className="text-sm">{dict.product.quantity}</span>
        <button type="button" className="btn btn-ghost" aria-label={dict.a11y.decreaseQty} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
        <span className="min-w-8 text-center">{orderedQuantity}</span>
        <button type="button" className="btn btn-ghost" aria-label={dict.a11y.increaseQty} onClick={() => setQuantity((value) => Math.min(variant.stockQuantity, 20, value + 1))}>+</button>
      </div>
      <p className="text-sm text-stone">{dict.product.stock}: {variant.stockQuantity}{variant.stockQuantity > 0 && variant.stockQuantity <= product.lowStockThreshold ? ` · ${dict.product.lowStock}` : ""}</p>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          if (resolvedCity.length < 2) setCityError(dict.errors.invalid_city);
          else setCityError("");
          void form.handleSubmit(submit)(event);
        }}
        onFocusCapture={beginCheckout}
      >
        <label className="grid gap-2 text-sm">
          {dict.direct.firstName}
          <input className="field" autoComplete="given-name" {...form.register("firstName")} />
          {fieldMessage("firstName") ? <span className="text-red-900">{fieldMessage("firstName")}</span> : null}
        </label>
        <label className="grid gap-2 text-sm">
          {dict.direct.lastName}
          <input className="field" autoComplete="family-name" {...form.register("lastName")} />
          {fieldMessage("lastName") ? <span className="text-red-900">{fieldMessage("lastName")}</span> : null}
        </label>
        <label className="grid gap-2 text-sm">
          {dict.checkout.phone}
          <input className="field" inputMode="tel" autoComplete="tel" placeholder={dict.checkout.phoneHint} {...form.register("phone")} />
          {fieldMessage("phone") ? <span className="text-red-900">{fieldMessage("phone")}</span> : null}
        </label>
        <label className="grid gap-2 text-sm">
          {dict.checkout.address}
          <textarea className="field min-h-24" autoComplete="street-address" {...form.register("address")} />
          {fieldMessage("address") ? <span className="text-red-900">{fieldMessage("address")}</span> : null}
        </label>
        <div className="grid gap-2 text-sm">
          <label htmlFor="direct-city">{dict.checkout.city}</label>
          <CitySelect id="direct-city" cities={cities} value={city} onChange={setCity} />
          {city === "__other" ? <input className="field" value={other} onChange={(event) => setOther(event.target.value)} placeholder={dict.checkout.city} autoComplete="address-level2" /> : null}
          {cityError ? <span className="text-red-900">{cityError}</span> : null}
        </div>
        <aside className="grid gap-2 border border-line p-4 text-sm">
          <h2 className="font-display text-2xl">{dict.direct.summary}</h2>
          <div className="flex justify-between gap-3"><span>{dict.direct.product}</span><span>{product.name}</span></div>
          <div className="flex justify-between gap-3"><span>{dict.direct.price}</span><span>{formatMoney(price, locale)}</span></div>
          <div className="flex justify-between gap-3"><span>{dict.direct.quantity}</span><span>{orderedQuantity}</span></div>
          <div className="flex justify-between gap-3"><span>{dict.direct.shipping}</span><span>{quote ? formatMoney(quote.shippingFeeMad, locale) : dict.checkout.quoting}</span></div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-base"><span>{dict.direct.total}</span><span>{quote ? formatMoney(quote.totalMad, locale) : "—"}</span></div>
          <p className="text-xs uppercase tracking-[0.14em] text-champagne">{dict.checkout.cod}</p>
        </aside>
        {error ? <p className="text-sm text-red-900">{error}</p> : null}
        <div className="hidden md:block">{submitButton}</div>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory p-3 md:hidden">{submitButton}</div>
      </form>
    </div>
  );
}
