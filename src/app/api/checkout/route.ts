import { NextResponse } from "next/server";
import { statusFor, type ErrorCode } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http";
import { metaClientContext, sendMetaEvent } from "@/lib/meta/capi";
import { splitPersonName } from "@/lib/meta/capi-payload";
import { metaPurchaseEventId } from "@/lib/meta/event-id";
import { metaContentId } from "@/lib/meta/product";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { placeOrder, quoteOrder } from "@/lib/services/checkout";
import { tiktokCommerce } from "@/lib/tiktok/commerce";
import { sendTikTokEvent } from "@/lib/tiktok/events";
import { checkoutSchema } from "@/lib/validations/commerce";

function sameOriginPage(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer") ?? "";
  if (origin && referer.startsWith(`${origin}/`)) return referer.slice(0, 500);
  return origin ? `${origin}/checkout` : undefined;
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, code: "invalid_items" }, { status: 400 });
  const phone = normalizeMoroccanPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ ok: false, code: "invalid_phone" }, { status: 400 });
  const quoted = await quoteOrder({ city: parsed.data.city, locale: parsed.data.locale, items: parsed.data.items }).catch(() => null);
  const result = await placeOrder({ ...parsed.data, phone, notes: parsed.data.notes ?? "" });
  if (!result.ok) return NextResponse.json({ ok: false, code: result.code }, { status: statusFor(result.code as ErrorCode) });
  if (result.order.replayed) return NextResponse.json({ ok: true, order: result.order });

  const commerce = tiktokCommerce(
    quoted?.ok
      ? quoted.quote.lines.map((line) => ({ id: line.sku.trim() || line.productId, name: line.name, quantity: line.quantity, price: line.unitPriceMad }))
      : parsed.data.items.map((item) => ({ id: item.productId, quantity: item.quantity })),
    Number(result.order.total_mad),
  );
  if (commerce) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ip = /^[0-9a-fA-F:.]+$/.test(forwarded) ? forwarded : undefined;
    const ttp = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith("_ttp="))?.slice(5);
    await sendTikTokEvent({
      ...commerce,
      event: "Purchase",
      eventId: result.order.order_number,
      pageUrl: sameOriginPage(request),
      phone,
      ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ttp: ttp ? decodeURIComponent(ttp).slice(0, 200) : undefined,
    }).catch(() => undefined);
  }

  const lines = quoted?.ok ? quoted.quote.lines : [];
  const products = lines.length
    ? lines.map((line) => ({ id: metaContentId({ id: line.productId, sku: line.sku }), quantity: line.quantity, itemPrice: line.unitPriceMad }))
    : parsed.data.items.map((item) => ({ id: metaContentId({ id: item.productId }), quantity: item.quantity }));
  const person = splitPersonName(parsed.data.fullName);
  const context = metaClientContext(request);
  const eventId = metaPurchaseEventId(result.order.order_number);
  const pageUrl = sameOriginPage(request);
  const value = Number(result.order.total_mad);
  // Attendu avant la fin du handler : Vercel ne fige la fonction qu'une fois cette promesse réglée.
  await sendMetaEvent({
    eventName: "Purchase",
    eventId,
    eventTime: Math.floor(Date.now() / 1000),
    eventSourceUrl: pageUrl,
    value,
    orderId: result.order.order_number,
    contentIds: products.map((item) => item.id),
    contents: products,
    numItems: products.reduce((sum, item) => sum + item.quantity, 0),
    user: {
      phone,
      firstName: person.firstName,
      lastName: person.lastName,
      city: parsed.data.city,
      country: "ma",
      ip: context.ip,
      userAgent: context.userAgent,
      fbp: context.fbp,
      fbc: context.fbc,
    },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, order: result.order, ...(commerce ? { tiktok: { eventId: result.order.order_number, ...commerce } } : {}) });
}
