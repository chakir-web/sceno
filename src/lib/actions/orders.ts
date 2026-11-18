"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/auth/session";
import { errorCode } from "@/lib/errors";
import { asArray } from "@/lib/http";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { canTransitionShipment, shipmentStatuses, type ConfirmationStatus, type ShipmentStatus } from "@/lib/orders/transitions";
import { createParcel, findOzoneCityById, getCities, getParcelInfo, mapOzoneStatusToScenoStatus, matchOzoneCity, ozoneConfigured, trackParcel } from "@/lib/shipping/ozone";
import { creationRefusal, ozoneDispatchBlock } from "@/lib/shipping/ozone-rules";
import { csvRecords } from "@/lib/csv";
import { listCarriers } from "@/lib/services/settings";

async function staffClient() {
  const session = await getSession();
  if (!session.supabase || !session.profile?.isActive || (session.profile.role !== "admin" && session.profile.role !== "confirmer")) {
    redirect("/auth/login");
  }
  return session;
}

function refresh(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/shipments");
  revalidatePath("/confirmer/orders");
  revalidatePath(`/confirmer/orders/${orderId}`);
  revalidatePath("/confirmer/dashboard");
  revalidatePath("/confirmer/history");
}

export async function transitionOrderAction(formData: FormData) {
  const session = await staffClient();
  const orderId = String(formData.get("orderId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const to = String(formData.get("to") ?? "");
  if (kind === "shipment" && session.profile?.role !== "admin") return { ok: false as const, code: "forbidden" };
  const { error } = await session.supabase.rpc("transition_order", {
    p_order_id: orderId,
    p_kind: kind,
    p_to: to,
    p_note: String(formData.get("note") ?? ""),
  });
  if (error) return { ok: false as const, code: errorCode(error) };
  refresh(orderId);
  return { ok: true as const };
}

export async function assignOrderForm(formData: FormData) {
  await assignOrderAction(formData);
}

export async function updateDeliveryForm(formData: FormData) {
  await updateDeliveryAction(formData);
}

export async function addNoteForm(formData: FormData) {
  await addNoteAction(formData);
}

export async function saveShipmentForm(formData: FormData) {
  await saveShipmentAction(formData);
}

export async function adjustStockForm(formData: FormData) {
  await adjustStockAction(formData);
}

export async function saveCarrierForm(formData: FormData) {
  await saveCarrier(formData);
}

export async function assignOrderAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const { error } = await supabase.rpc("assign_order", {
    p_order_id: orderId,
    p_confirmer_id: String(formData.get("confirmerId") ?? ""),
  });
  if (error) return { ok: false as const, code: errorCode(error) };
  refresh(orderId);
  return { ok: true as const };
}

export async function updateDeliveryAction(formData: FormData) {
  const session = await staffClient();
  const orderId = String(formData.get("orderId") ?? "");
  const manualRaw = String(formData.get("manualShipping") ?? "").trim();
  const manual = session.profile?.role === "admin" && manualRaw !== "" ? Number(manualRaw) : null;
  if (manual != null && !Number.isFinite(manual)) return { ok: false as const, code: "invalid_items" };
  const { error } = await session.supabase.rpc("update_order_delivery", {
    p_order_id: orderId,
    p_city: String(formData.get("city") ?? ""),
    p_address: String(formData.get("address") ?? ""),
    p_manual_shipping: manual,
  });
  if (error) return { ok: false as const, code: errorCode(error) };
  refresh(orderId);
  return { ok: true as const };
}

export async function addNoteAction(formData: FormData) {
  const session = await staffClient();
  const orderId = String(formData.get("orderId") ?? "");
  const { error } = await session.supabase.rpc("add_order_note", {
    p_order_id: orderId,
    p_body: String(formData.get("body") ?? ""),
  });
  if (error) return { ok: false as const, code: errorCode(error) };
  refresh(orderId);
  return { ok: true as const };
}

export async function adjustStockAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const delta = Number(formData.get("delta"));
  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: String(formData.get("variantId") ?? ""),
    p_delta: delta,
    p_reason: String(formData.get("reason") ?? "adjustment"),
  });
  if (error) return { ok: false as const, code: errorCode(error) };
  revalidatePath("/admin/inventory");
  return { ok: true as const };
}

export async function saveCarrier(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    is_active: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  };
  if (payload.name.length < 2) return { ok: false as const, code: "invalid_items" };
  const query = id
    ? supabase.from("carriers").update(payload).eq("id", id)
    : supabase.from("carriers").insert(payload);
  const { error } = await query;
  if (error) return { ok: false as const, code: errorCode(error) };
  revalidatePath("/admin/carriers");
  revalidatePath("/admin/shipments");
  return { ok: true as const };
}

export async function saveShipmentAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  const shipped = String(formData.get("shippedAt") ?? "");
  const feeRaw = String(formData.get("carrierFee") ?? "").trim();
  const { error } = await supabase.rpc("upsert_shipment", {
    p_order_id: orderId,
    p_carrier_id: String(formData.get("carrierId") ?? "") || null,
    p_carrier_name: String(formData.get("carrierName") ?? ""),
    p_tracking: String(formData.get("tracking") ?? ""),
    p_status: status,
    p_shipped_at: shipped ? new Date(shipped).toISOString() : null,
    p_carrier_fee: feeRaw === "" ? null : Number(feeRaw),
    p_note: String(formData.get("note") ?? ""),
  });
  if (error) return { ok: false as const, code: errorCode(error) };
  refresh(orderId);
  return { ok: true as const };
}

export async function syncOzoneForm(formData: FormData) {
  await syncOzoneAction(formData);
}

export async function syncOzoneAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const { data } = await supabase.from("shipments").select("tracking_number").eq("order_id", orderId).maybeSingle();
  const tracking = String(data?.tracking_number ?? "").trim();
  if (!tracking) return { ok: false as const, code: "not_found" as const };
  const [tracked, info] = await Promise.all([trackParcel(tracking), getParcelInfo(tracking)]);
  const reading = tracked.ok ? tracked : info;
  const facts = reading.ok ? reading.facts : null;
  const { error } = await supabase.rpc("record_ozone_reading", {
    p_order_id: orderId,
    p_accepted: reading.ok,
    p_error: reading.ok ? null : reading.message,
    p_status: facts?.status ?? null,
    p_label: facts?.statusLabel ?? null,
    p_event_at: facts?.eventAt ?? null,
  });
  if (error) return { ok: false as const, code: errorCode(error) };
  const mapped = mapOzoneStatusToScenoStatus(facts?.status);
  if (mapped) {
    const { data: order } = await supabase.from("orders").select("confirmation_status, shipment_status").eq("id", orderId).maybeSingle();
    if (order && canTransitionShipment(order.shipment_status as ShipmentStatus, mapped, order.confirmation_status as ConfirmationStatus)) {
      await supabase.rpc("transition_order", { p_order_id: orderId, p_kind: "shipment", p_to: mapped, p_note: "Synchronisation Ozone Express" });
    }
  }
  refresh(orderId);
  return { ok: true as const };
}

export type OzoneSendState =
  | { ok: true; trackingNumber: string; status: string | null; statusLabel: string | null; createdAt: string }
  | { ok: false; message: string };

const ozoneRefusal: Record<string, string> = {
  not_confirmed: "La commande n'est pas confirmée.",
  ozone_exists: "Cette commande a déjà un colis Ozone Express.",
  ozone_busy: "Une création Ozone est déjà en cours pour cette commande.",
  already_shipped: "Cette commande n'est plus en préparation.",
  forbidden: "Action non autorisée.",
  invalid_name: "Le nom du destinataire est incomplet.",
  invalid_phone: "Le numéro de téléphone marocain est invalide.",
  invalid_address: "L'adresse est incomplète.",
  invalid_items: "Le montant à encaisser est invalide.",
  city_unknown: "Ville non reconnue par Ozone Express",
  not_configured: "Identifiants Ozone absents du serveur.",
  not_found: "Introuvable.",
  generic: "L'opération a échoué.",
};

export async function sendToOzoneAction(_previous: OzoneSendState | null, formData: FormData): Promise<OzoneSendState> {
  const { supabase } = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const chosenCityId = String(formData.get("ozoneCityId") ?? "").trim();
  const { data: order } = await supabase
    .from("orders")
    .select("id, confirmation_status, shipment_status, full_name, phone_normalized, city, address, customer_notes, total_mad, order_items(name_fr, quantity)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, message: ozoneRefusal.not_found };
  const { data: shipment } = await supabase.from("shipments").select("tracking_number, ozone_parcel_id, ozone_dispatch_started_at").eq("order_id", orderId).maybeSingle();
  const blocked = ozoneDispatchBlock({
    role: "admin",
    confirmation: String(order.confirmation_status),
    shipment: String(order.shipment_status),
    trackingNumber: shipment?.tracking_number,
    parcelId: shipment?.ozone_parcel_id,
    dispatchStartedAt: shipment?.ozone_dispatch_started_at,
  });
  if (blocked) return { ok: false, message: ozoneRefusal[blocked] ?? ozoneRefusal.generic };
  const phone = normalizeMoroccanPhone(String(order.phone_normalized ?? ""));
  const price = Number(order.total_mad);
  const early = creationRefusal({
    confirmed: order.confirmation_status === "confirmed",
    trackingNumber: shipment?.tracking_number,
    parcelId: shipment?.ozone_parcel_id,
    receiver: order.full_name,
    phone,
    address: order.address,
    priceMad: price,
    cityId: "pending",
  });
  if (early && early !== "city_unknown") return { ok: false, message: ozoneRefusal[early] ?? ozoneRefusal.generic };
  if (!ozoneConfigured()) return { ok: false, message: ozoneRefusal.not_configured };

  const cities = await getCities();
  if (!cities.ok) return { ok: false, message: cities.message };
  const city = findOzoneCityById(chosenCityId, cities.cities) ?? matchOzoneCity(String(order.city ?? ""), cities.cities);
  if (!city) return { ok: false, message: ozoneRefusal.city_unknown };

  const { error: claimError } = await supabase.rpc("claim_ozone_dispatch", { p_order_id: orderId });
  if (claimError) return { ok: false, message: ozoneRefusal[errorCode(claimError)] ?? ozoneRefusal.generic };

  const nature = asArray<{ name_fr?: string; quantity?: number }>(order.order_items)
    .map((item) => `${item.name_fr ?? ""} x${item.quantity ?? 1}`)
    .join(", ");
  const created = await createParcel({
    receiver: String(order.full_name),
    phone: phone ?? "",
    cityId: city.id,
    address: String(order.address),
    priceMad: price,
    note: String(order.customer_notes ?? ""),
    nature,
  });
  if (!created.ok || !created.facts.trackingNumber) {
    const message = created.ok ? "Ozone n'a pas renvoyé de numéro de suivi." : created.message;
    await supabase.rpc("fail_ozone_dispatch", { p_order_id: orderId, p_error: message });
    refresh(orderId);
    return { ok: false, message };
  }

  const createdAt = created.facts.eventAt ?? new Date().toISOString();
  const { error: saveError } = await supabase.rpc("save_ozone_parcel", {
    p_order_id: orderId,
    p_tracking: created.facts.trackingNumber,
    p_parcel_id: created.facts.parcelId,
    p_status: created.facts.status,
    p_label: created.facts.statusLabel,
    p_event_at: createdAt,
  });
  if (saveError) {
    return {
      ok: false,
      message: `Le colis existe chez Ozone Express (${created.facts.trackingNumber}) mais l'enregistrement SCENO a échoué. Ne renvoyez pas cette commande.`,
    };
  }
  if (order.shipment_status === "pending") {
    await supabase.rpc("transition_order", {
      p_order_id: orderId,
      p_kind: "shipment",
      p_to: "prepared",
      p_note: "Colis Ozone Express créé, en attente de ramassage.",
    });
  }
  refresh(orderId);
  return {
    ok: true,
    trackingNumber: created.facts.trackingNumber,
    status: created.facts.status,
    statusLabel: created.facts.statusLabel,
    createdAt,
  };
}

export async function importShipments(formData: FormData) {
  const { supabase } = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, code: "invalid_items", failed: [] as { row: number; code: string }[], imported: 0 };
  const records = csvRecords(await file.text());
  const carriers = await listCarriers();
  const failed: { row: number; code: string }[] = [];
  let imported = 0;
  for (const [index, record] of records.entries()) {
    const orderNumber = (record.order_number || "").trim().toUpperCase();
    const status = (record.status || "").trim();
    if (status && !shipmentStatuses.includes(status as (typeof shipmentStatuses)[number])) {
      failed.push({ row: index + 2, code: "invalid_items" });
      continue;
    }
    const { data: order } = await supabase.from("orders").select("id").eq("order_number", orderNumber).maybeSingle();
    if (!order) {
      failed.push({ row: index + 2, code: "not_found" });
      continue;
    }
    const carrierName = (record.carrier_name || "").trim();
    const carrier = carriers.data.find((item) => item.name.toLowerCase() === carrierName.toLowerCase());
    const shipped = (record.shipped_at || "").trim();
    const fee = (record.carrier_fee_mad || "").trim();
    const { error } = await supabase.rpc("upsert_shipment", {
      p_order_id: order.id,
      p_carrier_id: carrier?.id ?? null,
      p_carrier_name: carrierName,
      p_tracking: record.tracking_number || "",
      p_status: status,
      p_shipped_at: shipped ? new Date(shipped).toISOString() : null,
      p_carrier_fee: fee === "" ? null : Number(fee),
      p_note: "csv-import",
    });
    if (error) failed.push({ row: index + 2, code: errorCode(error) });
    else imported += 1;
  }
  revalidatePath("/admin/shipments");
  return { ok: true as const, imported, failed };
}
