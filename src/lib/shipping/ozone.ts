import "server-only";
import {
  deliveryNoteRef,
  findOzoneCityById,
  interpretOzoneBody,
  matchOzoneCity,
  mapOzoneStatusToScenoStatus,
  officialDeliveryNotePdfUrl,
  ozoneErrorMessage,
  type OzoneCity,
  type OzoneFacts,
} from "@/lib/shipping/ozone-rules";

const BASE = "https://api.ozonexpress.ma";
const CITY_TTL_MS = 60 * 60 * 1000;

export type { OzoneCity, OzoneFacts };
export { findOzoneCityById, mapOzoneStatusToScenoStatus, matchOzoneCity, officialDeliveryNotePdfUrl };

export type OzoneParcelDraft = {
  receiver: string;
  phone: string;
  cityId: string;
  address: string;
  priceMad: number;
  note?: string;
  nature?: string;
};

export type OzoneCall =
  | { ok: true; facts: OzoneFacts }
  | { ok: false; message: string };

let cityCache: { at: number; cities: OzoneCity[] } | null = null;

function credentials() {
  const id = process.env.OZONE_EXPRESS_API_ID?.trim();
  const key = process.env.OZONE_EXPRESS_API_KEY?.trim();
  if (!id || !key) return null;
  return { id, key };
}

export function ozoneConfigured() {
  return credentials() !== null;
}

export function redactOzone(value: string) {
  const key = process.env.OZONE_EXPRESS_API_KEY?.trim();
  const id = process.env.OZONE_EXPRESS_API_ID?.trim();
  let text = value;
  if (key) text = text.split(key).join("[redacted]");
  if (id) text = text.split(id).join("[id]");
  return text.replace(/\s+/g, " ").trim().slice(0, 400);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function priceOf(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function interpret(body: unknown, fallback: string): OzoneCall {
  const reading = interpretOzoneBody(body);
  if (!reading.ok) return { ok: false, message: redactOzone(reading.message || fallback) };
  return reading;
}

export async function getCities(): Promise<{ ok: true; cities: OzoneCity[] } | { ok: false; message: string }> {
  if (cityCache && Date.now() - cityCache.at < CITY_TTL_MS) {
    return { ok: true, cities: cityCache.cities };
  }
  let response: Response;
  try {
    response = await fetch(`${BASE}/cities`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  } catch {
    return { ok: false, message: "Ozone Express est injoignable." };
  }
  const body = await response.json().catch(() => null);
  const cities = asRecord(body).CITIES;
  if (!response.ok || !cities || typeof cities !== "object") {
    return { ok: false, message: "La liste des villes Ozone est illisible." };
  }
  const list = Object.values(cities as Record<string, unknown>).flatMap((entry) => {
    const city = asRecord(entry);
    const id = textOf(city.ID);
    const name = textOf(city.NAME);
    if (!id || !name) return [];
    return [{
      id,
      ref: textOf(city.REF),
      name,
      deliveredPriceMad: priceOf(city["DELIVERED-PRICE"]),
      returnedPriceMad: priceOf(city["RETURNED-PRICE"]),
      refusedPriceMad: priceOf(city["REFUSED-PRICE"]),
    }];
  });
  if (!list.length) return { ok: false, message: "La liste des villes Ozone est vide." };
  cityCache = { at: Date.now(), cities: list };
  return { ok: true, cities: list };
}

async function postRaw(action: string, fields: Record<string, string>) {
  const creds = credentials();
  if (!creds) return { ok: false as const, message: "Identifiants Ozone absents du serveur." };
  const url = `${BASE}/customers/${encodeURIComponent(creds.id)}/${encodeURIComponent(creds.key)}/${action}`;
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body: form, cache: "no-store", signal: AbortSignal.timeout(20000) });
  } catch {
    return { ok: false as const, message: "Ozone Express est injoignable." };
  }
  const body = await response.json().catch(() => null);
  if (!response.ok && body == null) return { ok: false as const, message: "Ozone a refusé la requête." };
  const error = body == null ? "Réponse Ozone illisible." : ozoneErrorMessage(body);
  if (error) return { ok: false as const, message: redactOzone(error) };
  if (!response.ok) return { ok: false as const, message: "Ozone a refusé la requête." };
  return { ok: true as const, body };
}

async function postForm(action: string, fields: Record<string, string>): Promise<OzoneCall> {
  const posted = await postRaw(action, fields);
  if (!posted.ok) return posted;
  return interpret(posted.body, "Ozone a refusé la requête.");
}

export function trackParcel(trackingNumber: string) {
  const number = trackingNumber.trim();
  if (!number) return Promise.resolve({ ok: false as const, message: "Numéro de suivi absent." });
  return postForm("tracking", { "tracking-number": number });
}

export function getParcelInfo(trackingNumber: string) {
  const number = trackingNumber.trim();
  if (!number) return Promise.resolve({ ok: false as const, message: "Numéro de suivi absent." });
  return postForm("parcel-info", { "tracking-number": number });
}

/**
 * Crée un colis en ramassage. parcel-stock est fixé à 0.
 * N'est appelé que par l'action admin « Envoyer à Ozone Express ».
 */
export function createParcel(draft: OzoneParcelDraft): Promise<OzoneCall> {
  const receiver = draft.receiver.trim();
  const phone = draft.phone.trim();
  const cityId = draft.cityId.trim();
  const address = draft.address.trim();
  if (receiver.length < 2 || !phone || !cityId || address.length < 5) {
    return Promise.resolve({ ok: false, message: "Données Ozone incomplètes." });
  }
  if (!Number.isFinite(draft.priceMad) || draft.priceMad <= 0) {
    return Promise.resolve({ ok: false, message: "Montant Ozone invalide." });
  }
  const fields: Record<string, string> = {
    "parcel-receiver": receiver,
    "parcel-phone": phone,
    "parcel-city": cityId,
    "parcel-address": address,
    "parcel-price": draft.priceMad.toFixed(2),
    "parcel-stock": "0",
  };
  if (draft.note?.trim()) fields["parcel-note"] = draft.note.trim().slice(0, 400);
  if (draft.nature?.trim()) fields["parcel-nature"] = draft.nature.trim().slice(0, 200);
  if (draft.priceMad > 5000) fields["parcel-declared-value"] = draft.priceMad.toFixed(2);
  return postForm("add-parcel", fields);
}

/**
 * Bon de livraison officiel, en trois appels documentés :
 * add-delivery-note, add-parcel-to-delivery-note, save-delivery-note.
 * N'est appelé que lorsque l'administrateur demande le bordereau.
 */
export async function createDeliveryNote(trackingNumber: string): Promise<{ ok: true; ref: string } | { ok: false; message: string }> {
  const tracking = trackingNumber.trim();
  if (!tracking) return { ok: false, message: "Numéro de suivi absent." };
  const created = await postRaw("add-delivery-note", {});
  if (!created.ok) return created;
  const ref = deliveryNoteRef(created.body);
  if (!ref) return { ok: false, message: "Ozone n'a pas renvoyé la référence du bon de livraison." };
  const added = await postRaw("add-parcel-to-delivery-note", { Ref: ref, "Codes[0]": tracking });
  if (!added.ok) return added;
  const saved = await postRaw("save-delivery-note", { Ref: ref });
  if (!saved.ok) return saved;
  return { ok: true, ref };
}

export async function fetchDeliveryNotePdf(ref: string): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; message: string }> {
  const url = officialDeliveryNotePdfUrl(ref);
  if (!url) return { ok: false, message: "Référence de bordereau invalide." };
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  } catch {
    return { ok: false, message: "Le bordereau Ozone est injoignable." };
  }
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("pdf")) {
    return { ok: false, message: "Ozone n'a pas renvoyé le PDF du bordereau." };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 80 || bytes.byteLength > 8_000_000) {
    return { ok: false, message: "Le bordereau Ozone est illisible." };
  }
  return { ok: true, bytes };
}
