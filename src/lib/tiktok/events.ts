import "server-only";
import type { TikTokCommerce } from "@/lib/tiktok/commerce";
import { buildTikTokBody, type TikTokServerEvent } from "@/lib/tiktok/event-payload";

const ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

export async function sendTikTokEvent(input: TikTokCommerce & {
  event: TikTokServerEvent;
  eventId: string;
  pageUrl?: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
  ttp?: string;
}) {
  if (!input.content_id || !input.contents.length) return { ok: false as const, skipped: "missing_content" as const };

  const token = process.env.TIKTOK_EVENTS_API_TOKEN?.trim() ?? "";
  if (!token) {
    console.info("[tiktok]", JSON.stringify({ event: input.event, eventId: input.eventId, skipped: "missing_token" }));
    return { ok: false as const, skipped: "missing_token" as const };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token },
      body: JSON.stringify(buildTikTokBody(input)),
      signal: AbortSignal.timeout(4000),
    });
    const json = (await response.json().catch(() => null)) as { code?: unknown; message?: unknown; request_id?: unknown } | null;
    const code = typeof json?.code === "number" ? json.code : null;
    const message = typeof json?.message === "string" ? json.message.slice(0, 180) : "";
    const requestId = typeof json?.request_id === "string" ? json.request_id : "";
    console.info("[tiktok]", JSON.stringify({ event: input.event, eventId: input.eventId, http: response.status, code, message, requestId }));
    return { ok: response.ok && code === 0, http: response.status, code };
  } catch (error) {
    const message = error instanceof Error ? error.name : "error";
    console.info("[tiktok]", JSON.stringify({ event: input.event, eventId: input.eventId, http: 0, message }));
    return { ok: false as const, http: 0 };
  }
}
