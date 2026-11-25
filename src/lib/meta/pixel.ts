const configured = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
export const META_PIXEL_ID = /^\d{6,20}$/.test(configured) ? configured : "1150414564108419";

type MetaParams = Record<string, string | number | string[] | { id: string; quantity: number; item_price?: number }[] | undefined>;

type Fbq = {
  (command: "init", pixelId: string): void;
  (command: "track", event: string, params?: MetaParams, options?: { eventID: string }): void;
  queue: unknown[];
};

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

const DEBUG_EVENTS = new Set(["ViewContent", "AddToCart", "InitiateCheckout", "Purchase"]);

function debugMeta(event: string, params: MetaParams | undefined, eventID?: string) {
  if (!DEBUG_EVENTS.has(event) || typeof window === "undefined") return;
  const enabled = process.env.NODE_ENV !== "production" || new URLSearchParams(window.location.search).has("meta_debug");
  if (!enabled) return;
  const contentIds = Array.isArray(params?.content_ids) ? params.content_ids.filter((id): id is string => typeof id === "string") : [];
  const contents = Array.isArray(params?.contents) ? params.contents : [];
  console.info("[meta]", {
    event,
    event_id: eventID ?? "",
    content_ids: contentIds,
    content_type: params?.content_type === "product" ? "product" : "",
    contents,
    value: typeof params?.value === "number" ? params.value : null,
    currency: typeof params?.currency === "string" ? params.currency : "",
  });
}

export function trackMeta(event: string, params?: MetaParams, eventID?: string) {
  debugMeta(event, params, eventID);
  if (!META_PIXEL_ID || typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params, eventID ? { eventID } : undefined);
}

type MetaContent = { id: string; quantity: number; item_price?: number };

export function reportMeta(
  event: "ViewContent" | "AddToCart" | "InitiateCheckout",
  params: MetaParams & { content_ids?: string[]; contents?: MetaContent[]; value?: number; num_items?: number; content_name?: string; content_category?: string },
  eventId: string,
) {
  trackMeta(event, params, eventId);
  if (typeof fetch !== "function" || !params.content_ids?.length) return;
  void fetch("/api/meta/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      eventId,
      value: params.value,
      currency: "MAD",
      content_ids: params.content_ids,
      content_name: params.content_name,
      content_category: params.content_category,
      contents: params.contents,
      num_items: params.num_items,
      url: window.location.href,
    }),
    keepalive: true,
  }).catch(() => undefined);
}
