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

function priceOf(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** Lit `CITIES` tel que l'API Ozone le renvoie. `ID` est un nombre, pas une chaîne. */
export function readOzoneCities(body: unknown): { ok: true; cities: OzoneCity[] } | { ok: false; message: string } {
  const cities = asRecord(body).CITIES;
  const entries = Array.isArray(cities) ? cities : cities && typeof cities === "object" ? Object.values(cities) : null;
  if (!entries) return { ok: false, message: "La liste des villes Ozone est illisible." };
  const list = entries.flatMap((entry) => {
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
  return { ok: true, cities: list };
}

export function ozoneParcelFields(draft: {
  receiver: string;
  phone: string;
  cityId: string;
  address: string;
  priceMad: number;
  note?: string;
  nature?: string;
  reference?: string;
}): { ok: true; fields: Record<string, string> } | { ok: false; message: string } {
  const receiver = draft.receiver.trim();
  const phone = draft.phone.trim();
  const cityId = draft.cityId.trim();
  const address = draft.address.trim();
  if (receiver.length < 2 || !phone || !cityId || address.length < 5) {
    return { ok: false, message: "Données Ozone incomplètes." };
  }
  if (!Number.isFinite(draft.priceMad) || draft.priceMad <= 0) {
    return { ok: false, message: "Montant Ozone invalide." };
  }
  const note = [draft.reference, draft.note].map((value) => value?.trim() ?? "").filter(Boolean).join(" — ").slice(0, 400);
  const fields: Record<string, string> = {
    "parcel-receiver": receiver,
    "parcel-phone": phone,
    "parcel-city": cityId,
    "parcel-address": address,
    "parcel-price": draft.priceMad.toFixed(2),
    "parcel-stock": "0",
  };
  if (note) fields["parcel-note"] = note;
  if (draft.nature?.trim()) fields["parcel-nature"] = draft.nature.trim().slice(0, 200);
  if (draft.priceMad > 5000) fields["parcel-declared-value"] = draft.priceMad.toFixed(2);
  return { ok: true, fields };
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
  for (const value of Object.values(root)) {
    const message = resultMessage(value);
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
  const containers = [root, ...Object.values(root).map((value) => asRecord(value))];
  for (const record of containers) {
    const ref = textOf(record.ref) || textOf(record.REF) || textOf(record["DN-REF"]) || textOf(record["BL-REF"]);
    if (ref) return ref;
  }
  return null;
}

const deliveryNotePdfPath = {
  note: "pdf-delivery-note",
  "tickets-a4": "pdf-delivery-note-tickets",
  "tickets-10": "pdf-delivery-note-tickets-4-4",
} as const;

export type DeliveryNotePdfKind = keyof typeof deliveryNotePdfPath;

/** URL officielle Ozone. Aucun autre hôte n'est accepté. */
export function officialDeliveryNotePdfUrl(ref: string, kind: DeliveryNotePdfKind = "note") {
  const value = ref.trim();
  const path = deliveryNotePdfPath[kind];
  if (!path || !/^[\w.-]{3,80}$/.test(value)) return null;
  return `https://client.ozoneexpress.ma/${path}?dn-ref=${encodeURIComponent(value)}`;
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
