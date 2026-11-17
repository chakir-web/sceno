"use server";

import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/locales";
import { normalizeMoroccanPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/utils";

export async function setLocale(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set("sceno_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, code: "not_configured" };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, code: "invalid" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false as const, code: "invalid" };
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { ok: false as const, code: "inactive" };
  }
  if (profile.role === "admin") redirect("/admin/dashboard");
  if (profile.role === "confirmer") redirect("/confirmer/dashboard");
  await supabase.auth.signOut();
  return { ok: false as const, code: "forbidden" };
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/auth/login");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, code: "not_configured" };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { ok: false as const, code: "invalid" };
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/reset-password`,
  });
  return { ok: true as const };
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, code: "not_configured" };
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) return { ok: false as const, code: "password" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false as const, code: "generic" };
  return { ok: true as const };
}

function tokensMatch(input: string, expected: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function bootstrapAdmin(formData: FormData) {
  const expected = process.env.SCENO_SETUP_TOKEN?.trim() ?? "";
  const token = String(formData.get("token") ?? "");
  if (!expected || !tokensMatch(token, expected)) return { ok: false as const, code: "forbidden" };
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, code: "not_configured" };
  const { count, error: countError } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  if (countError) return { ok: false as const, code: "not_configured" };
  if ((count ?? 0) > 0) return { ok: false as const, code: "forbidden" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!email.includes("@") || password.length < 10 || fullName.length < 3) return { ok: false as const, code: "password" };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) return { ok: false as const, code: "duplicate" };
  const { error: profileError } = await admin.from("profiles").update({ role: "admin", full_name: fullName, is_active: true }).eq("id", data.user.id);
  if (profileError) return { ok: false as const, code: "generic" };
  await admin.from("audit_logs").insert({
    actor_id: data.user.id,
    action: "admin.bootstrap",
    entity: "profiles",
    entity_id: data.user.id,
    metadata: { email },
  });
  return { ok: true as const };
}

export async function createConfirmer(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, code: "not_configured" };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = normalizeMoroccanPhone(String(formData.get("phone") ?? "")) ?? null;
  if (!email.includes("@") || password.length < 10 || fullName.length < 3) return { ok: false as const, code: "password" };
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) return { ok: false as const, code: "duplicate" };
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: "confirmer", full_name: fullName, phone, is_active: true })
    .eq("id", data.user.id);
  if (profileError) return { ok: false as const, code: "generic" };
  revalidatePath("/admin/confirmers");
  return { ok: true as const };
}

export async function updateConfirmer(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "");
  const phone = phoneRaw.trim() ? normalizeMoroccanPhone(phoneRaw) : null;
  if (phoneRaw.trim() && !phone) return { ok: false as const, code: "invalid_phone" };
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone, is_active: isActive })
    .eq("id", id)
    .eq("role", "confirmer");
  if (error) return { ok: false as const, code: "generic" };
  await supabase.rpc("write_audit", { p_action: "confirmer.update", p_entity: "profiles", p_entity_id: id, p_metadata: { isActive } });
  revalidatePath("/admin/confirmers");
  return { ok: true as const };
}

export async function createConfirmerForm(formData: FormData) {
  await createConfirmer(formData);
}

export async function updateConfirmerForm(formData: FormData) {
  await updateConfirmer(formData);
}
