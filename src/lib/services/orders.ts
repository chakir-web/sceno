import { errorCode } from "@/lib/errors";
import { asArray, asNumber, cleanQuery } from "@/lib/http";
import type { ConfirmationStatus, PaymentStatus, ShipmentStatus } from "@/lib/orders/transitions";
import { createClient } from "@/lib/supabase/server";
import type { DataState, OrderRecord, StaffProfile } from "@/types/commerce";

const pageSize = 20;

type OrderRow = {
  id: string;
  order_number: string;
  full_name: string;
  phone_normalized: string;
  city: string;
  address: string;
  customer_notes: string | null;
  locale: "fr" | "ar";
  confirmation_status: ConfirmationStatus;
  shipment_status: ShipmentStatus;
  payment_status: PaymentStatus;
  subtotal_mad: number | string;
  shipping_fee_mad: number | string;
  total_mad: number | string;
  assigned_confirmer_id: string | null;
  created_at: string;
  profiles?: { full_name: string } | { full_name: string }[] | null;
  order_items?: ItemRow[] | null;
  order_notes?: NoteRow[] | null;
  order_status_history?: HistoryRow[] | null;
  shipments?: ShipmentRow | ShipmentRow[] | null;
};

type ItemRow = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  name_fr: string;
  name_ar: string;
  variant_label: string | null;
  sku: string;
  unit_price_mad: number | string;
  quantity: number;
  line_total_mad: number | string;
};

type NoteRow = { id: string; body: string; created_at: string; profiles?: { full_name: string } | { full_name: string }[] | null };
type HistoryRow = { id: string; kind: string; from_status: string | null; to_status: string; note: string | null; created_at: string };
type ShipmentRow = { carrier_name: string; tracking_number: string; carrier_fee_mad: number | string | null; shipped_at: string | null };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function mapOrder(row: OrderRow, detailed = false): OrderRecord {
  const confirmer = one(row.profiles);
  const shipment = one(row.shipments);
  const order: OrderRecord = {
    id: row.id,
    orderNumber: row.order_number,
    fullName: row.full_name,
    phone: row.phone_normalized,
    city: row.city,
    address: row.address,
    customerNotes: row.customer_notes,
    locale: row.locale === "ar" ? "ar" : "fr",
    confirmationStatus: row.confirmation_status,
    shipmentStatus: row.shipment_status,
    paymentStatus: row.payment_status,
    subtotalMad: asNumber(row.subtotal_mad),
    shippingFeeMad: asNumber(row.shipping_fee_mad),
    totalMad: asNumber(row.total_mad),
    assignedConfirmerId: row.assigned_confirmer_id,
    confirmerName: confirmer?.full_name ?? null,
    createdAt: row.created_at,
    carrierName: shipment?.carrier_name || null,
    trackingNumber: shipment?.tracking_number || null,
    carrierFeeMad: shipment?.carrier_fee_mad == null ? null : asNumber(shipment.carrier_fee_mad),
    shippedAt: shipment?.shipped_at ?? null,
  };
  if (!detailed) return order;
  order.items = asArray<ItemRow>(row.order_items).map((item) => ({
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    nameFr: item.name_fr,
    nameAr: item.name_ar,
    variantLabel: item.variant_label,
    sku: item.sku,
    unitPriceMad: asNumber(item.unit_price_mad),
    quantity: item.quantity,
    lineTotalMad: asNumber(item.line_total_mad),
  }));
  order.notes = asArray<NoteRow>(row.order_notes).map((note) => ({
    id: note.id,
    body: note.body,
    createdAt: note.created_at,
    authorName: one(note.profiles)?.full_name || "SCENO",
  }));
  order.history = asArray<HistoryRow>(row.order_status_history).map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    fromStatus: entry.from_status,
    toStatus: entry.to_status,
    note: entry.note,
    createdAt: entry.created_at,
  }));
  return order;
}

const listSelect = `
  id, order_number, full_name, phone_normalized, city, address, customer_notes, locale,
  confirmation_status, shipment_status, payment_status, subtotal_mad, shipping_fee_mad, total_mad,
  assigned_confirmer_id, created_at,
  profiles!orders_assigned_confirmer_id_fkey (full_name)
`;

const detailSelect = `
  ${listSelect},
  order_items (id, product_id, variant_id, name_fr, name_ar, variant_label, sku, unit_price_mad, quantity, line_total_mad),
  order_notes (id, body, created_at, profiles (full_name)),
  order_status_history (id, kind, from_status, to_status, note, created_at),
  shipments (carrier_name, tracking_number, carrier_fee_mad, shipped_at)
`;

export async function listOrders(filters: {
  q?: string;
  confirmation?: string;
  shipment?: string;
  page?: number;
  assignedTo?: string;
  unassigned?: boolean;
  history?: boolean;
  confirmedOnly?: boolean;
}): Promise<DataState<{ items: OrderRecord[]; total: number; pageSize: number }>> {
  const empty = { items: [], total: 0, pageSize };
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: empty };
  const page = filters.page ?? 1;
  let query = supabase.from("orders").select(listSelect, { count: "exact" }).order("created_at", { ascending: false });
  if (filters.confirmation) query = query.eq("confirmation_status", filters.confirmation);
  if (filters.shipment) query = query.eq("shipment_status", filters.shipment);
  if (filters.assignedTo) query = query.eq("assigned_confirmer_id", filters.assignedTo);
  if (filters.unassigned) query = query.is("assigned_confirmer_id", null);
  if (filters.history) query = query.in("confirmation_status", ["confirmed", "cancelled", "unreachable"]);
  if (filters.confirmedOnly) query = query.eq("confirmation_status", "confirmed");
  const q = cleanQuery(filters.q);
  if (q) query = query.or(`order_number.ilike.%${q}%,full_name.ilike.%${q}%,phone_normalized.ilike.%${q}%`);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return { configured: true, ready: false, data: empty };
  return {
    configured: true,
    ready: true,
    data: { items: ((data ?? []) as OrderRow[]).map((row) => mapOrder(row)), total: count ?? 0, pageSize },
  };
}

export async function getOrder(id: string): Promise<DataState<OrderRecord | null>> {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: null };
  const { data, error } = await supabase.from("orders").select(detailSelect).eq("id", id).maybeSingle();
  if (error) return { configured: true, ready: false, data: null };
  return { configured: true, ready: true, data: data ? mapOrder(data as OrderRow, true) : null };
}

export async function listConfirmers(): Promise<DataState<StaffProfile[]>> {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: [] };
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, is_active")
    .eq("role", "confirmer")
    .order("full_name");
  if (error) return { configured: true, ready: false, data: [] };
  return {
    configured: true,
    ready: true,
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      role: "confirmer" as const,
      fullName: (row.full_name as string) || "",
      phone: (row.phone as string | null) ?? null,
      isActive: Boolean(row.is_active),
    })),
  };
}

export async function confirmerStats() {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: [] as Array<StaffProfile & { received: number; treated: number; confirmed: number; cancelled: number; unreachable: number; rate: number | null }> };
  const [people, orders] = await Promise.all([
    listConfirmers(),
    supabase.from("orders").select("assigned_confirmer_id, confirmation_status"),
  ]);
  if (!people.ready || orders.error) return { configured: people.configured, ready: false, data: [] };
  return {
    configured: true,
    ready: true,
    data: people.data.map((person) => {
      const rows = (orders.data ?? []).filter((order) => order.assigned_confirmer_id === person.id);
      const confirmed = rows.filter((order) => order.confirmation_status === "confirmed").length;
      const cancelled = rows.filter((order) => order.confirmation_status === "cancelled").length;
      const unreachable = rows.filter((order) => order.confirmation_status === "unreachable").length;
      const treated = confirmed + cancelled + unreachable;
      return {
        ...person,
        received: rows.length,
        treated,
        confirmed,
        cancelled,
        unreachable,
        rate: treated === 0 ? null : confirmed / treated,
      };
    }),
  };
}

export async function listCustomers(): Promise<DataState<Array<{ id: string; fullName: string; phone: string; city: string; address: string; createdAt: string; orderCount: number; totalMad: number }>>> {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: [] };
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone_normalized, city, address, created_at, orders (id, total_mad, confirmation_status)")
    .order("created_at", { ascending: false });
  if (error) return { configured: true, ready: false, data: [] };
  return {
    configured: true,
    ready: true,
    data: (data ?? []).map((row) => {
      const orders = asArray<{ id: string; total_mad: number | string; confirmation_status: string }>(row.orders);
      return {
        id: row.id as string,
        fullName: row.full_name as string,
        phone: row.phone_normalized as string,
        city: (row.city as string) ?? "",
        address: (row.address as string) ?? "",
        createdAt: row.created_at as string,
        orderCount: orders.length,
        totalMad: orders.reduce((sum, order) => sum + asNumber(order.total_mad), 0),
      };
    }),
  };
}

export async function getCustomer(id: string) {
  const customers = await listCustomers();
  const customer = customers.data.find((item) => item.id === id) ?? null;
  if (!customer) return { ...customers, data: null, orders: [] as OrderRecord[] };
  const orders = await listOrders({ q: customer.phone, page: 1 });
  return { configured: customers.configured, ready: customers.ready, data: customer, orders: orders.data.items };
}

export async function listInventory() {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: [], movements: [] as Movement[] };
  const [variants, movements] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, sku, size, color, stock_quantity, is_active, products (id, sku, low_stock_threshold, product_translations (locale, name))")
      .order("sku"),
    supabase.from("inventory_movements").select("id, quantity_delta, reason, created_at, variant_id").order("created_at", { ascending: false }).limit(40),
  ]);
  if (variants.error || movements.error) return { configured: true, ready: false, data: [], movements: [] };
  return {
    configured: true,
    ready: true,
    data: (variants.data ?? []).map((row) => {
      const product = one(row.products as unknown as { sku: string; low_stock_threshold: number; product_translations?: { locale: string; name: string }[] } | { sku: string; low_stock_threshold: number; product_translations?: { locale: string; name: string }[] }[] | null);
      const name = product?.product_translations?.find((item) => item.locale === "fr")?.name ?? product?.sku ?? row.sku;
      return {
        id: row.id as string,
        sku: row.sku as string,
        label: [row.size, row.color].filter(Boolean).join(" / "),
        stockQuantity: row.stock_quantity as number,
        threshold: product?.low_stock_threshold ?? 0,
        productName: name as string,
        isActive: Boolean(row.is_active),
      };
    }),
    movements: (movements.data ?? []).map((row) => ({
      id: row.id as string,
      delta: row.quantity_delta as number,
      reason: row.reason as string,
      createdAt: row.created_at as string,
      variantId: row.variant_id as string | null,
    })),
  };
}

export type Movement = { id: string; delta: number; reason: string; createdAt: string; variantId: string | null };

export async function shipmentRows(ids?: string[]) {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("orders")
    .select("order_number, full_name, phone_normalized, city, address, total_mad, shipping_fee_mad, confirmation_status, order_items (name_fr, quantity)")
    .eq("confirmation_status", "confirmed");
  if (ids && ids.length > 0) query = query.in("id", ids);
  const { data } = await query;
  return (data ?? []).map((row) => ({
    orderNumber: row.order_number as string,
    customerName: row.full_name as string,
    phone: row.phone_normalized as string,
    city: row.city as string,
    address: row.address as string,
    totalMad: asNumber(row.total_mad),
    shippingFeeMad: asNumber(row.shipping_fee_mad),
    items: asArray<{ name_fr: string; quantity: number }>(row.order_items)
      .map((item) => `${item.name_fr} x${item.quantity}`)
      .join(" | "),
  }));
}

export { errorCode };
