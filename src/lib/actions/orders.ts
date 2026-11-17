"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/auth/session";
import { errorCode } from "@/lib/errors";
import { shipmentStatuses } from "@/lib/orders/transitions";
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
