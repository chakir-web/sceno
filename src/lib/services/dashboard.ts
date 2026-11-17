import { asArray, asNumber } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export type DashboardData = {
  ordersTotal: number;
  ordersToday: number;
  revenueCollected: number;
  pipelineConfirmed: number;
  pendingConfirmation: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  returned: number;
  confirmationRate: number | null;
  deliveryRate: number | null;
  lowStock: number;
  unassigned: number;
  series: { day: string; orders: number; collected: number }[];
  recentOrders: { id: string; orderNumber: string; fullName: string; totalMad: number; confirmationStatus: string; shipmentStatus: string; createdAt: string }[];
  popularProducts: { name: string; quantity: number; amount: number }[];
};

const emptyDashboard: DashboardData = {
  ordersTotal: 0,
  ordersToday: 0,
  revenueCollected: 0,
  pipelineConfirmed: 0,
  pendingConfirmation: 0,
  confirmed: 0,
  shipped: 0,
  delivered: 0,
  cancelled: 0,
  returned: 0,
  confirmationRate: null,
  deliveryRate: null,
  lowStock: 0,
  unassigned: 0,
  series: [],
  recentOrders: [],
  popularProducts: [],
};

export async function getAdminDashboard() {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: emptyDashboard };
  const { data, error } = await supabase.rpc("admin_dashboard");
  if (error || !data) return { configured: true, ready: false, data: emptyDashboard };
  const row = data as Record<string, unknown>;
  return {
    configured: true,
    ready: true,
    data: {
      ordersTotal: asNumber(row.orders_total),
      ordersToday: asNumber(row.orders_today),
      revenueCollected: asNumber(row.revenue_collected),
      pipelineConfirmed: asNumber(row.pipeline_confirmed),
      pendingConfirmation: asNumber(row.pending_confirmation),
      confirmed: asNumber(row.confirmed),
      shipped: asNumber(row.shipped),
      delivered: asNumber(row.delivered),
      cancelled: asNumber(row.cancelled),
      returned: asNumber(row.returned),
      confirmationRate: row.confirmation_rate == null ? null : asNumber(row.confirmation_rate),
      deliveryRate: row.delivery_rate == null ? null : asNumber(row.delivery_rate),
      lowStock: asNumber(row.low_stock),
      unassigned: asNumber(row.unassigned),
      series: asArray<{ day: string; orders: number; collected: number }>(row.series).map((item) => ({
        day: String(item.day).slice(0, 10),
        orders: asNumber(item.orders),
        collected: asNumber(item.collected),
      })),
      recentOrders: asArray<Record<string, unknown>>(row.recent_orders).map((item) => ({
        id: String(item.id),
        orderNumber: String(item.order_number),
        fullName: String(item.full_name),
        totalMad: asNumber(item.total_mad),
        confirmationStatus: String(item.confirmation_status),
        shipmentStatus: String(item.shipment_status),
        createdAt: String(item.created_at),
      })),
      popularProducts: asArray<Record<string, unknown>>(row.popular_products).map((item) => ({
        name: String(item.name),
        quantity: asNumber(item.quantity),
        amount: asNumber(item.amount),
      })),
    } satisfies DashboardData,
  };
}

export type ReportData = {
  created: number;
  confirmed: number;
  delivered: number;
  collected: number;
  confirmedAmount: number;
  shippingCharged: number;
  carrierFees: number;
  cancelled: number;
  refused: number;
  returned: number;
  byDay: PeriodRow[];
  byWeek: PeriodRow[];
  byMonth: PeriodRow[];
  confirmers: ConfirmerRow[];
  topProducts: { name: string; quantity: number; collectedQuantity: number; amount: number }[];
};

export type PeriodRow = { period: string; orders: number; collected: number };
export type ConfirmerRow = {
  id: string;
  name: string;
  received: number;
  treated: number;
  confirmed: number;
  cancelled: number;
  unreachable: number;
  rate: number | null;
};

export async function getAdminReports(from: string, to: string) {
  const supabase = await createClient();
  const empty: ReportData = {
    created: 0, confirmed: 0, delivered: 0, collected: 0, confirmedAmount: 0, shippingCharged: 0,
    carrierFees: 0, cancelled: 0, refused: 0, returned: 0, byDay: [], byWeek: [], byMonth: [], confirmers: [], topProducts: [],
  };
  if (!supabase) return { configured: false, ready: false, data: empty };
  const { data, error } = await supabase.rpc("admin_reports", { p_from: from, p_to: to });
  if (error || !data) return { configured: true, ready: false, data: empty };
  const row = data as Record<string, unknown>;
  const periods = (value: unknown) =>
    asArray<Record<string, unknown>>(value).map((item) => ({
      period: String(item.period).slice(0, 10),
      orders: asNumber(item.orders),
      collected: asNumber(item.collected),
    }));
  return {
    configured: true,
    ready: true,
    data: {
      created: asNumber(row.created),
      confirmed: asNumber(row.confirmed),
      delivered: asNumber(row.delivered),
      collected: asNumber(row.collected),
      confirmedAmount: asNumber(row.confirmed_amount),
      shippingCharged: asNumber(row.shipping_charged),
      carrierFees: asNumber(row.carrier_fees),
      cancelled: asNumber(row.cancelled),
      refused: asNumber(row.refused),
      returned: asNumber(row.returned),
      byDay: periods(row.by_day),
      byWeek: periods(row.by_week),
      byMonth: periods(row.by_month),
      confirmers: asArray<Record<string, unknown>>(row.confirmers).map((item) => ({
        id: String(item.id),
        name: String(item.name),
        received: asNumber(item.received),
        treated: asNumber(item.treated),
        confirmed: asNumber(item.confirmed),
        cancelled: asNumber(item.cancelled),
        unreachable: asNumber(item.unreachable),
        rate: item.rate == null ? null : asNumber(item.rate),
      })),
      topProducts: asArray<Record<string, unknown>>(row.top_products).map((item) => ({
        name: String(item.name),
        quantity: asNumber(item.quantity),
        collectedQuantity: asNumber(item.collected_quantity),
        amount: asNumber(item.amount),
      })),
    } satisfies ReportData,
  };
}

export async function getConfirmerDashboard() {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: null };
  const { data, error } = await supabase.rpc("confirmer_dashboard");
  if (error || !data) return { configured: true, ready: false, data: null };
  const row = data as Record<string, unknown>;
  return {
    configured: true,
    ready: true,
    data: {
      received: asNumber(row.received),
      treated: asNumber(row.treated),
      confirmed: asNumber(row.confirmed),
      cancelled: asNumber(row.cancelled),
      unreachable: asNumber(row.unreachable),
      rate: row.rate == null ? null : asNumber(row.rate),
      queue: asArray<Record<string, unknown>>(row.queue).map((item) => ({
        id: String(item.id),
        orderNumber: String(item.order_number),
        fullName: String(item.full_name),
        phone: String(item.phone_normalized),
        city: String(item.city),
        totalMad: asNumber(item.total_mad),
        confirmationStatus: String(item.confirmation_status),
        createdAt: String(item.created_at),
      })),
    },
  };
}
