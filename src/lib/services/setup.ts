import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRole, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function getSetupStatus() {
  const configured = isSupabaseConfigured();
  const serviceRole = hasServiceRole();
  const tokenSet = Boolean(process.env.SCENO_SETUP_TOKEN?.trim());
  if (!configured) return { configured, serviceRole, tokenSet, hasAdmin: false, migrationReady: false };

  const admin = createAdminClient();
  if (admin) {
    const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    return { configured, serviceRole, tokenSet, hasAdmin: (count ?? 0) > 0, migrationReady: !error };
  }

  const supabase = await createClient();
  const { error } = await supabase!.from("store_settings").select("id").limit(1);
  return { configured, serviceRole, tokenSet, hasAdmin: false, migrationReady: !error };
}
