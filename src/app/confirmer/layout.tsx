import { Shell } from "@/components/shell";
import { requireConfirmer } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getConfirmerDashboard } from "@/lib/services/dashboard";

export default async function ConfirmerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireConfirmer();
  const { dict } = await getI18n();
  const board = await getConfirmerDashboard();
  const waiting = board.data?.queue.length ?? 0;
  return (
    <Shell
      dict={dict}
      area={dict.confirmer.area}
      name={profile.fullName}
      logoutLabel={dict.auth.logout}
      items={[
        { href: "/confirmer/dashboard", label: dict.confirmer.nav.dashboard, icon: "dashboard" },
        { href: "/confirmer/orders", label: dict.confirmer.nav.orders, icon: "orders", badge: waiting || undefined },
        { href: "/confirmer/history", label: dict.confirmer.nav.history, icon: "history" },
      ]}
    >
      {children}
    </Shell>
  );
}
