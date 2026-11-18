import type { ShipmentStatus } from "@/lib/orders/transitions";

export type OzoneCity = {
  id: string;
  ref: string;
  name: string;
  deliveredPriceMad: number;
  returnedPriceMad: number;
  refusedPriceMad: number;
};

export type OzoneFacts = {
  trackingNumber: string | null;
  parcelId: string | null;
  status: string | null;
  statusLabel: string | null;
  eventAt: string | null;
};

export type OzoneBody =
  | { ok: true; facts: OzoneFacts }
  | { ok: false; message: string };

/**
 * Aucun code Ozone n'a encore été observé sur un colis réel.
 * N'ajoutez une entrée qu'après l'avoir lue dans une réponse Ozone.
 * delivered, refused et returned ne sont jamais déduits.
 */
const confirmedStatusMap: Record<string, ShipmentStatus> = {};

export function foldCity(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Correspondance exacte uniquement. Plusieurs villes proches ne comptent pas. */
export function matchOzoneCity(city: string, cities: OzoneCity[]): OzoneCity | null {
  const wanted = foldCity(city);
  if (!wanted) return null;
  const exact = cities.filter((item) => foldCity(item.name) === wanted);
  return exact.length === 1 ? exact[0] : null;
}

export function findOzoneCityById(id: string, cities: OzoneCity[]) {
  const wanted = id.trim();
  if (!wanted) return null;
  return cities.find((item) => item.id === wanted) ?? null;
}

export function mapOzoneStatusToScenoStatus(status: string | null | undefined): ShipmentStatus | null {
  const key = (status ?? "").trim().toLowerCase();
  if (!key) return null;
  return confirmedStatusMap[key] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textOf(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function resultMessage(value: unknown) {
  const record = asRecord(value);
  if (textOf(record.RESULT).toUpperCase() !== "ERROR") return null;
  return textOf(record.MESSAGE) || "Ozone a refusé la requête.";
}

export function ozoneErrorMessage(body: unknown) {
  const root = asRecord(body);
  const direct = resultMessage(root);
  if (direct) return direct;
  for (const key of ["CHECK_API", "ADD-PARCEL", "PARCEL", "PARCEL-INFO", "TRACKING", "DELIVERY-NOTE"]) {
    const message = resultMessage(root[key]);
    if (message) return message;
  }
  return null;
}

function nestedRecords(root: Record<string, unknown>) {
  return [root, ...["ADD-PARCEL", "PARCEL", "PARCEL-INFO", "TRACKING", "LAST-TRACKING"].map((key) => asRecord(root[key]))];
}

function firstText(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = textOf(record[key]);
      if (value) return value;
    }
  }
  return null;
}

function eventAt(records: Record<string, unknown>[]) {
  const raw = firstText(records, ["TIME", "DATE", "CREATED-AT", "LAST-UPDATE"]);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function interpretOzoneBody(body: unknown): OzoneBody {
  const root = asRecord(body);
  const error = ozoneErrorMessage(body);
  if (error) return { ok: false, message: error };
  const records = nestedRecords(root);
  const trackingNumber = firstText(records, ["TRACKING-NUMBER", "TRACKING_NUMBER"]);
  if (!trackingNumber) return { ok: false, message: "Ozone n'a pas renvoyé de numéro de suivi." };
  return {
    ok: true,
    facts: {
      trackingNumber,
      parcelId: firstText(records, ["PARCEL-ID", "PARCEL_ID"]),
      status: firstText(records, ["STATUT", "STATUS", "LAST-STATUS"]),
      statusLabel: firstText(records, ["STATUS-NAME", "STATUT-NAME"]),
      eventAt: eventAt(records),
    },
  };
}

export function deliveryNoteRef(body: unknown) {
  const root = asRecord(body);
  const nested = asRecord(root["DELIVERY-NOTE"]);
  return textOf(root.ref) || textOf(root.REF) || textOf(nested.ref) || textOf(nested.REF) || null;
}

/** URL officielle du PDF standard. Aucun autre hôte n'est accepté. */
export function officialDeliveryNotePdfUrl(ref: string) {
  const value = ref.trim();
  if (!/^[\w.-]{3,80}$/.test(value)) return null;
  return `https://client.ozoneexpress.ma/pdf-delivery-note?dn-ref=${encodeURIComponent(value)}`;
}

const preparationShipments = new Set(["pending", "prepared"]);

/** Décision unique avant add-parcel. Le verrou SQL reste l'autorité en base. */
export function ozoneDispatchBlock(input: {
  role: string;
  confirmation: string;
  shipment: string;
  trackingNumber?: string | null;
  parcelId?: string | null;
  dispatchStartedAt?: string | null;
  now?: number;
}) {
  if (input.role !== "admin") return "forbidden" as const;
  if (input.confirmation !== "confirmed") return "not_confirmed" as const;
  if (!preparationShipments.has(input.shipment)) return "already_shipped" as const;
  if ((input.trackingNumber ?? "").trim() || (input.parcelId ?? "").trim()) return "ozone_exists" as const;
  if (input.dispatchStartedAt) {
    const started = new Date(input.dispatchStartedAt).getTime();
    const age = (input.now ?? Date.now()) - started;
    if (Number.isFinite(started) && age >= 0 && age < 2 * 60 * 1000) return "ozone_busy" as const;
  }
  return null;
}

export function creationRefusal(input: {
  confirmed: boolean;
  trackingNumber?: string | null;
  parcelId?: string | null;
  receiver?: string | null;
  phone?: string | null;
  address?: string | null;
  priceMad?: number | null;
  cityId?: string | null;
}) {
  if (!input.confirmed) return "not_confirmed" as const;
  if ((input.trackingNumber ?? "").trim() || (input.parcelId ?? "").trim()) return "ozone_exists" as const;
  if ((input.receiver ?? "").trim().length < 2) return "invalid_name" as const;
  if (!input.phone) return "invalid_phone" as const;
  if ((input.address ?? "").trim().length < 5) return "invalid_address" as const;
  if (input.priceMad == null || !Number.isFinite(input.priceMad) || input.priceMad < 0) return "invalid_items" as const;
  if (input.priceMad === 0) return "invalid_items" as const;
  if (!(input.cityId ?? "").trim()) return "city_unknown" as const;
  return null;
}
