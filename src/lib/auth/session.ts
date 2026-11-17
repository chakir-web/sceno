import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StaffProfile } from "@/types/commerce";

export async function getSession() {
  const supabase = await createClient();
  if (!supabase) return { configured: false as const, supabase: null, user: null, profile: null as StaffProfile | null };
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { configured: true as const, supabase, user: null, profile: null as StaffProfile | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, is_active")
    .eq("id", user.id)
    .maybeSingle();
  const mapped: StaffProfile | null = profile
    ? {
        id: profile.id,
        role: profile.role as StaffProfile["role"],
        fullName: profile.full_name ?? "",
        phone: profile.phone,
        isActive: profile.is_active,
        email: user.email,
      }
    : null;
  return { configured: true as const, supabase, user, profile: mapped };
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session.configured || !session.user || session.profile?.role !== "admin" || !session.profile.isActive || !session.supabase) {
    redirect("/auth/login");
  }
  return { supabase: session.supabase, profile: session.profile, user: session.user };
}

export async function requireConfirmer() {
  const session = await getSession();
  if (!session.configured || !session.user || session.profile?.role !== "confirmer" || !session.profile.isActive || !session.supabase) {
    redirect("/auth/login");
  }
  return { supabase: session.supabase, profile: session.profile, user: session.user };
}
