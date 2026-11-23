import { roundMoney } from "@/lib/pricing";

export type GaItemInput = {
  id: string;
  name: string;
  variant?: string;
  category?: string;
  price: number;
  quantity: number;
};

export type GaItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  item_variant?: string;
  item_category?: string;
};

export type GaPurchase = {
  transaction_id: string;
  value: number;
  currency: "MAD";
  shipping?: number;
  items: GaItem[];
};

const sentPurchases = new Set<string>();
const STORAGE_KEY = "sceno_ga_purchase";

export function gaItems(lines: GaItemInput[]): GaItem[] {
  const items: GaItem[] = [];
  for (const line of lines) {
    const item_id = line.id.trim();
    const item_name = line.name.trim();
    const quantity = Number.isFinite(line.quantity) ? Math.min(20, Math.round(line.quantity)) : 0;
    const price = Number.isFinite(line.price) ? roundMoney(line.price) : Number.NaN;
    if (!item_id || !item_name || quantity < 1 || !Number.isFinite(price) || price < 0) continue;
    const item_variant = line.variant?.trim();
    const item_category = line.category?.trim();
    items.push({
      item_id,
      item_name: item_name.slice(0, 160),
      price,
      quantity,
      ...(item_variant ? { item_variant: item_variant.slice(0, 120) } : {}),
      ...(item_category ? { item_category: item_category.slice(0, 120) } : {}),
    });
  }
  return items;
}

export function purchaseEvent(input: {
  replayed?: boolean;
  transactionId: string;
  value: number;
  shipping?: number;
  items: GaItemInput[];
}): GaPurchase | null {
  if (input.replayed) return null;
  const transaction_id = input.transactionId.trim();
  const items = gaItems(input.items);
  if (!transaction_id || !items.length || !Number.isFinite(input.value) || input.value < 0) return null;
  const shipping = input.shipping != null && Number.isFinite(input.shipping) && input.shipping >= 0 ? roundMoney(input.shipping) : undefined;
  return {
    transaction_id,
    value: roundMoney(input.value),
    currency: "MAD",
    ...(shipping != null ? { shipping } : {}),
    items,
  };
}

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

function send(name: string, params: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return false;
  window.gtag("event", name, params);
  return true;
}

function alreadySent(transactionId: string) {
  if (sentPurchases.has(transactionId)) return true;
  try {
    const known = (sessionStorage.getItem(STORAGE_KEY) ?? "").split(",").filter(Boolean);
    if (known.includes(transactionId)) {
      sentPurchases.add(transactionId);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function remember(transactionId: string) {
  sentPurchases.add(transactionId);
  try {
    const known = (sessionStorage.getItem(STORAGE_KEY) ?? "").split(",").filter(Boolean);
    if (!known.includes(transactionId)) known.push(transactionId);
    sessionStorage.setItem(STORAGE_KEY, known.slice(-40).join(","));
  } catch {
    return;
  }
}

export function trackPurchase(input: {
  replayed?: boolean;
  transactionId: string;
  value: number;
  shipping?: number;
  items: GaItemInput[];
}) {
  const payload = purchaseEvent(input);
  if (!payload || alreadySent(payload.transaction_id)) return false;
  sentPurchases.add(payload.transaction_id);
  if (!send("purchase", payload)) {
    sentPurchases.delete(payload.transaction_id);
    return false;
  }
  remember(payload.transaction_id);
  return true;
}

export function trackViewItem(item: GaItemInput, value: number) {
  const items = gaItems([item]);
  if (!items.length || !Number.isFinite(value) || value < 0) return;
  send("view_item", { currency: "MAD", value: roundMoney(value), items });
}

export function trackAddToCart(item: GaItemInput, value: number) {
  const items = gaItems([item]);
  if (!items.length || !Number.isFinite(value) || value < 0) return;
  send("add_to_cart", { currency: "MAD", value: roundMoney(value), items });
}

export function trackBeginCheckout(lines: GaItemInput[], value: number) {
  const items = gaItems(lines);
  if (!items.length || !Number.isFinite(value) || value < 0) return;
  send("begin_checkout", { currency: "MAD", value: roundMoney(value), items });
}
