import "server-only";
import { META_PIXEL_ID } from "@/lib/meta/pixel";
import { buildMetaData, capiTestCode, type MetaServerInput } from "@/lib/meta/capi-payload";

const GRAPH_VERSION = "v27.0";
const sentPurchases = new Set<string>();

export function reserveMetaPurchase(eventId: string) {
  if (sentPurchases.has(eventId)) return false;
  sentPurchases.add(eventId);
  if (sentPurchases.size > 500) {
    const oldest = sentPurchases.values().next().value;
    if (oldest) sentPurchases.delete(oldest);
  }
  return true;
}

export function metaTestEventCode() {
  return capiTestCode(process.env.META_CAPI_TEST_EVENT_CODE ?? "", {
    vercel: process.env.VERCEL_ENV,
    node: process.env.NODE_ENV,
  });
}

function redact(text: string, token: string) {
  return token ? text.split(token).join("[redacted]") : text;
}

export async function sendMetaEvent(input: MetaServerInput) {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim() ?? "";
  if (!META_PIXEL_ID || !token) {
    console.info("[meta]", JSON.stringify({ event: input.eventName, eventId: input.eventId, skipped: "missing_token" }));
    return { ok: false as const, skipped: "missing_token" as const };
  }
  if (input.eventName === "Purchase" && !reserveMetaPurchase(input.eventId)) {
    console.info("[meta]", JSON.stringify({ event: input.eventName, eventId: input.eventId, skipped: "duplicate" }));
    return { ok: false as const, skipped: "duplicate" as const };
  }

  const testEventCode = metaTestEventCode();
  const body: Record<string, unknown> = { data: [buildMetaData(input)], access_token: token };
  if (testEventCode) body.test_event_code = testEventCode;

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    const json = (await response.json().catch(() => null)) as {
      events_received?: unknown;
      fbtrace_id?: unknown;
      error?: { code?: unknown; message?: unknown };
    } | null;
    const received = typeof json?.events_received === "number" ? json.events_received : null;
    const trace = typeof json?.fbtrace_id === "string" ? json.fbtrace_id : "";
    const errorCode = typeof json?.error?.code === "number" ? json.error.code : null;
    const errorMessage = typeof json?.error?.message === "string" ? redact(json.error.message, token).slice(0, 180) : "";
    console.info("[meta]", JSON.stringify({
      event: input.eventName,
      eventId: input.eventId,
      http: response.status,
      eventsReceived: received,
      fbtraceId: trace,
      errorCode,
      errorMessage,
    }));
    return { ok: response.ok && received === 1, http: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.name : "error";
    console.info("[meta]", JSON.stringify({ event: input.eventName, eventId: input.eventId, http: 0, message }));
    return { ok: false as const, http: 0 };
  }
}

export function metaClientContext(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const real = request.headers.get("x-real-ip")?.trim() ?? "";
  const ipCandidate = forwarded || real;
  const header = request.headers.get("cookie") ?? "";
  const cookies = new Map<string, string>();
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies.set(key, decodeURIComponent(rest.join("=")));
  }
  return {
    ip: /^[0-9a-fA-F:.]+$/.test(ipCandidate) ? ipCandidate : undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
    fbp: cookies.get("_fbp"),
    fbc: cookies.get("_fbc"),
  };
}
