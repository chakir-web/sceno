import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/http";
import { metaClientContext, sendMetaEvent } from "@/lib/meta/capi";

const contentSchema = z.object({
  id: z.string().trim().min(1).max(80),
  quantity: z.number().int().positive().max(20),
  item_price: z.number().nonnegative().max(1_000_000).optional(),
});

const bodySchema = z.object({
  event: z.enum(["ViewContent", "AddToCart", "InitiateCheckout"]),
  eventId: z.string().trim().regex(/^(viewcontent|addtocart|initiatecheckout)_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  value: z.number().nonnegative().max(10_000_000).optional(),
  currency: z.literal("MAD").optional(),
  content_ids: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
  content_name: z.string().trim().max(160).optional(),
  content_category: z.string().trim().max(120).optional(),
  contents: z.array(contentSchema).max(30).optional(),
  num_items: z.number().int().positive().max(100).optional(),
  url: z.string().trim().max(500).optional(),
});

function pageUrl(request: Request, candidate?: string) {
  const origin = request.headers.get("origin");
  if (candidate && origin && candidate.startsWith(`${origin}/`)) return candidate.slice(0, 500);
  return origin ? `${origin}/` : undefined;
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const context = metaClientContext(request);
  const contents = (parsed.data.contents ?? []).map((item) => ({
    id: item.id,
    quantity: item.quantity,
    itemPrice: item.item_price,
  }));
  await sendMetaEvent({
    eventName: parsed.data.event,
    eventId: parsed.data.eventId,
    eventTime: Math.floor(Date.now() / 1000),
    eventSourceUrl: pageUrl(request, parsed.data.url),
    value: parsed.data.value,
    contentIds: parsed.data.content_ids,
    contents,
    numItems: parsed.data.num_items,
    contentName: parsed.data.content_name,
    contentCategory: parsed.data.content_category,
    user: context,
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
