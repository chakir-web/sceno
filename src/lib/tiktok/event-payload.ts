import { createHash } from "node:crypto";
import type { TikTokCommerce, TikTokContent } from "@/lib/tiktok/commerce";
import { tiktokPixelId } from "@/lib/tiktok/config";

export type TikTokServerEvent = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

export type TikTokServerContent = TikTokContent;

export function hashTikTokPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("212") && digits.length === 12 ? `0${digits.slice(3)}` : digits;
  if (!/^0[5-8]\d{8}$/.test(national)) return "";
  return createHash("sha256").update(`212${national.slice(1)}`).digest("hex");
}

export function buildTikTokBody(input: TikTokCommerce & {
  event: TikTokServerEvent;
  eventId: string;
  pageUrl?: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
  ttp?: string;
}) {
  const user: Record<string, string> = {};
  const phone = input.phone ? hashTikTokPhone(input.phone) : "";
  if (phone) user.phone = phone;
  if (input.ip) user.ip = input.ip;
  if (input.userAgent) user.user_agent = input.userAgent.slice(0, 500);
  if (input.ttp) user.ttp = input.ttp.slice(0, 200);

  const properties: Record<string, unknown> = {
    currency: "MAD",
    content_type: "product",
    content_id: input.content_id,
    content_ids: input.content_ids,
    contents: input.contents.map((item) => ({
      content_id: item.content_id,
      ...(item.content_name ? { content_name: item.content_name } : {}),
      quantity: item.quantity,
      ...(item.price !== undefined ? { price: item.price } : {}),
    })),
    quantity: input.quantity,
    num_items: input.num_items,
  };
  if (typeof input.value === "number" && Number.isFinite(input.value)) properties.value = Math.round(input.value * 100) / 100;
  if (input.content_category) properties.content_category = input.content_category;
  if (input.event === "Purchase") properties.order_id = input.eventId;

  return {
    event_source: "web",
    event_source_id: tiktokPixelId(),
    data: [
      {
        event: input.event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        user,
        ...(input.pageUrl ? { page: { url: input.pageUrl } } : {}),
        properties,
      },
    ],
  };
}
