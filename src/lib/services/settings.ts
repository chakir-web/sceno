import { isMissingSchema } from "@/lib/errors";
import { asNumber } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import type { Carrier, DataState, ShippingRate, StoreSettings } from "@/types/commerce";

type SettingsRow = {
  id: string;
  store_name: string;
  support_phone: string;
  support_email: string;
  address: string;
  currency: "MAD";
  default_locale: "fr" | "ar";
  default_shipping_fee_mad: number | string;
  about_fr: string;
  about_ar: string;
  instagram: string;
  facebook: string;
  logo_url: string | null;
};

export function mapSettings(row: SettingsRow): StoreSettings {
  return {
    id: row.id,
    storeName: row.store_name,
    supportPhone: row.support_phone,
    supportEmail: row.support_email,
    address: row.address,
    currency: "MAD",
    defaultLocale: row.default_locale === "ar" ? "ar" : "fr",
    defaultShippingFeeMad: asNumber(row.default_shipping_fee_mad),
    aboutFr: row.about_fr,
    aboutAr: row.about_ar,
    instagram: row.instagram,
    facebook: row.facebook,
    logoUrl: row.logo_url,
  };
}

export async function getSettings(): Promise<DataState<StoreSettings | null>> {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: null };
  const { data, error } = await supabase.from("store_settings").select("*").limit(1).maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return { configured: true, ready: false, data: null };
    return { configured: true, ready: false, data: null };
  }
  return { configured: true, ready: true, data: data ? mapSettings(data as SettingsRow) : null };
}

export async function listRates(admin = false): Promise<DataState<ShippingRate[]>> {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: [] };
  let query = supabase.from("shipping_rates").select("id, city, fee_mad, zone, is_active").order("city");
  if (!admin) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) {
    if (isMissingSchema(error)) return { configured: true, ready: false, data: [] };
    return { configured: true, ready: false, data: [] };
  }
  return {
    configured: true,
    ready: true,
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      city: row.city as string,
      feeMad: asNumber(row.fee_mad),
      zone: (row.zone as string) ?? "",
      isActive: Boolean(row.is_active),
    })),
  };
}

export async function listCarriers(): Promise<DataState<Carrier[]>> {
  const supabase = await createClient();
  if (!supabase) return { configured: false, ready: false, data: [] };
  const { data, error } = await supabase.from("carriers").select("id, name, phone, notes, is_active").order("name");
  if (error) return { configured: true, ready: false, data: [] };
  return {
    configured: true,
    ready: true,
    data: (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      phone: (row.phone as string) ?? "",
      notes: (row.notes as string) ?? "",
      isActive: Boolean(row.is_active),
    })),
  };
}
