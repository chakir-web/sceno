import { createHash } from "node:crypto";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { roundMoney } from "@/lib/pricing";

export type MetaServerEvent = "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

export type MetaContent = {
  id: string;
  quantity: number;
  itemPrice?: number;
};

export type MetaUserInput = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
  externalId?: string;
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
};

export type MetaServerInput = {
  eventName: MetaServerEvent;
  eventId: string;
  eventTime: number;
  eventSourceUrl?: string;
  value?: number;
  contentIds?: string[];
  contents?: MetaContent[];
  numItems?: number;
  contentName?: string;
  contentCategory?: string;
  orderId?: string;
  user?: MetaUserInput;
};

const FBP = /^fb\.1\.\d{10,13}\.\d{5,20}$/;
const FBC = /^fb\.1\.\d{10,13}\.[A-Za-z0-9_-]{5,200}$/;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function letters(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function hashMetaEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return "";
  return sha256(normalized);
}

export function hashMetaPhone(phone: string) {
  const national = normalizeMoroccanPhone(phone);
  if (!national) return "";
  return sha256(`212${national.slice(1)}`);
}

export function hashMetaText(value: string) {
  const normalized = letters(value);
  return normalized ? sha256(normalized) : "";
}

export function hashMetaCountry(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(normalized)) return "";
  return sha256(normalized);
}

function cookie(value: string | undefined, pattern: RegExp) {
  const trimmed = value?.trim() ?? "";
  return pattern.test(trimmed) ? trimmed : "";
}

export function metaUserData(input: MetaUserInput = {}) {
  const user: Record<string, string | string[]> = {};
  const email = input.email ? hashMetaEmail(input.email) : "";
  const phone = input.phone ? hashMetaPhone(input.phone) : "";
  const firstName = input.firstName ? hashMetaText(input.firstName) : "";
  const lastName = input.lastName ? hashMetaText(input.lastName) : "";
  const city = input.city ? hashMetaText(input.city) : "";
  const country = input.country ? hashMetaCountry(input.country) : "";
  const externalId = input.externalId ? hashMetaText(input.externalId) : "";
  if (email) user.em = [email];
  if (phone) user.ph = [phone];
  if (firstName) user.fn = [firstName];
  if (lastName) user.ln = [lastName];
  if (city) user.ct = [city];
  if (country) user.country = [country];
  if (externalId) user.external_id = [externalId];
  if (input.ip && /^[0-9a-fA-F:.]+$/.test(input.ip)) user.client_ip_address = input.ip;
  if (input.userAgent?.trim()) user.client_user_agent = input.userAgent.trim().slice(0, 500);
  const fbp = cookie(input.fbp, FBP);
  const fbc = cookie(input.fbc, FBC);
  if (fbp) user.fbp = fbp;
  if (fbc) user.fbc = fbc;
  return user;
}

export function capiTestCode(code: string, environment: { vercel?: string; node?: string }) {
  const value = code.trim();
  if (!/^TEST[A-Z0-9]{1,20}$/.test(value)) return "";
  if (environment.vercel === "production") return "";
  if (!environment.vercel && environment.node === "production") return "";
  return value;
}

export function splitPersonName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function buildMetaData(input: MetaServerInput) {
  const contentIds = (input.contentIds ?? []).map((id) => id.trim()).filter(Boolean).slice(0, 30);
  const contents = (input.contents ?? []).flatMap((item) => {
    const id = item.id.trim();
    if (!id || !Number.isFinite(item.quantity) || item.quantity <= 0) return [];
    return [{
      id,
      quantity: Math.min(20, Math.round(item.quantity)),
      ...(typeof item.itemPrice === "number" && Number.isFinite(item.itemPrice) ? { item_price: roundMoney(item.itemPrice) } : {}),
    }];
  }).slice(0, 30);
  const custom: Record<string, unknown> = { currency: "MAD" };
  if (typeof input.value === "number" && Number.isFinite(input.value)) custom.value = roundMoney(input.value);
  if (contentIds.length) {
    custom.content_ids = contentIds;
    custom.content_type = "product";
  }
  if (contents.length) custom.contents = contents;
  const numItems = input.numItems ?? contents.reduce((sum, item) => sum + item.quantity, 0);
  if (numItems > 0) custom.num_items = numItems;
  if (input.contentName?.trim()) custom.content_name = input.contentName.trim().slice(0, 160);
  if (input.contentCategory?.trim()) custom.content_category = input.contentCategory.trim().slice(0, 120);
  if (input.eventName === "Purchase" && input.orderId?.trim()) custom.order_id = input.orderId.trim();

  return {
    event_name: input.eventName,
    event_time: input.eventTime,
    event_id: input.eventId,
    action_source: "website" as const,
    ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl.slice(0, 500) } : {}),
    user_data: metaUserData(input.user),
    custom_data: custom,
  };
}
