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

export function trackMeta(event: string, params?: MetaParams, eventID?: string) {
  if (!META_PIXEL_ID || typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params, eventID ? { eventID } : undefined);
}
