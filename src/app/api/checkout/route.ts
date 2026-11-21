import { NextResponse } from "next/server";
import { statusFor, type ErrorCode } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { placeOrder, quoteOrder } from "@/lib/services/checkout";
import { tiktokCommerce } from "@/lib/tiktok/commerce";
import { sendTikTokEvent } from "@/lib/tiktok/events";
import { checkoutSchema } from "@/lib/validations/commerce";

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
    const origin = request.headers.get("origin");
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ip = /^[0-9a-fA-F:.]+$/.test(forwarded) ? forwarded : undefined;
    const ttp = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith("_ttp="))?.slice(5);
    await sendTikTokEvent({
      ...commerce,
      event: "Purchase",
      eventId: result.order.order_number,
      pageUrl: origin ? `${origin}/checkout` : undefined,
      phone,
      ip,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ttp: ttp ? decodeURIComponent(ttp).slice(0, 200) : undefined,
    }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, order: result.order, ...(commerce ? { tiktok: { eventId: result.order.order_number, ...commerce } } : {}) });
}
