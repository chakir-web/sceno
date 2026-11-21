import { tiktokPixelId } from "@/lib/tiktok/config";
import type { TikTokCommerce } from "@/lib/tiktok/commerce";

export const TIKTOK_PIXEL_ID = tiktokPixelId();

type Ttq = {
  page: () => void;
  track: (event: string, params?: TikTokCommerce, options?: { event_id: string }) => void;
};

declare global {
  interface Window {
    ttq?: Ttq;
    TiktokAnalyticsObject?: string;
    __scenoTiktokPixel?: string;
  }
}

const STANDARD_EVENT = {
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "Purchase",
} as const;

export function trackTikTokPage() {
  if (!TIKTOK_PIXEL_ID || typeof window === "undefined" || typeof window.ttq?.page !== "function") return;
  window.ttq.page();
}

export function trackTikTok(
  event: keyof typeof STANDARD_EVENT,
  params: TikTokCommerce | null,
  eventId?: string,
) {
  if (!params?.content_id || !params.contents.length) return;
  if (!TIKTOK_PIXEL_ID || typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  window.ttq.track(STANDARD_EVENT[event], params, eventId ? { event_id: eventId } : undefined);
}

export function reportTikTok(
  event: Exclude<keyof typeof STANDARD_EVENT, "Purchase">,
  params: TikTokCommerce | null,
  eventId: string,
) {
  if (!params?.content_id || !params.contents.length) return;
  trackTikTok(event, params, eventId);
  if (typeof fetch !== "function") return;
  void fetch("/api/tiktok/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      eventId,
      value: params.value,
      currency: "MAD" as const,
      content_category: params.content_category,
      contents: params.contents,
      url: window.location.href,
    }),
    keepalive: true,
  }).catch(() => undefined);
}
