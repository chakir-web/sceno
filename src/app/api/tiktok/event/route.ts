import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/http";
import { tiktokCommerce } from "@/lib/tiktok/commerce";
import { sendTikTokEvent } from "@/lib/tiktok/events";

const contentSchema = z.object({
  content_id: z.string().trim().min(1).max(120),
  content_name: z.string().trim().max(160).optional(),
  quantity: z.number().int().positive().max(20).optional(),
  price: z.number().nonnegative().max(1_000_000).optional(),
});

const bodySchema = z.object({
  event: z.enum(["ViewContent", "AddToCart", "InitiateCheckout"]),
  eventId: z.string().trim().min(8).max(80),
  value: z.number().nonnegative().max(10_000_000).optional(),
  currency: z.literal("MAD").optional(),
  content_category: z.string().trim().max(120).optional(),
  contents: z.array(contentSchema).max(30).optional(),
  url: z.string().trim().max(500).optional(),
});

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const real = request.headers.get("x-real-ip")?.trim() ?? "";
  const value = forwarded || real;
  return /^[0-9a-fA-F:.]+$/.test(value) ? value : undefined;
}

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("=")).slice(0, 200);
  }
  return undefined;
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const commerce = tiktokCommerce(
    (parsed.data.contents ?? []).map((item) => ({
      id: item.content_id,
      name: item.content_name,
      quantity: item.quantity,
      price: item.price,
    })),
    parsed.data.value,
    parsed.data.content_category,
  );
  if (!commerce) return NextResponse.json({ ok: true });
  const pageUrl = parsed.data.url && /^https?:\/\//.test(parsed.data.url) ? parsed.data.url : undefined;
  await sendTikTokEvent({
    ...commerce,
    event: parsed.data.event,
    eventId: parsed.data.eventId,
    pageUrl,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
    ttp: cookieValue(request, "_ttp"),
  });
  return NextResponse.json({ ok: true });
}
