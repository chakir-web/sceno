import { Shell } from "@/components/shell";
import { requireAdmin } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getAdminDashboard } from "@/lib/services/dashboard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  const { dict } = await getI18n();
  const dashboard = await getAdminDashboard();
  const nav = dict.admin.nav;
  const pending = dashboard.data.pendingConfirmation;
  const lowStock = dashboard.data.lowStock;
  return (
    <Shell
      dict={dict}
      area={dict.admin.area}
      name={profile.fullName}
      logoutLabel={dict.auth.logout}
      items={[
        { href: "/admin/dashboard", label: nav.dashboard, icon: "dashboard" },
        { href: "/admin/products", label: nav.products, icon: "products" },
        { href: "/admin/categories", label: nav.categories, icon: "categories" },
        { href: "/admin/inventory", label: nav.inventory, icon: "inventory", badge: lowStock || undefined },
        { href: "/admin/orders", label: nav.orders, icon: "orders", badge: pending || undefined },
        { href: "/admin/customers", label: nav.customers, icon: "customers" },
        { href: "/admin/confirmers", label: nav.confirmers, icon: "confirmers" },
        { href: "/admin/shipments", label: nav.shipments, icon: "shipments" },
        { href: "/admin/carriers", label: nav.carriers, icon: "carriers" },
        { href: "/admin/reports", label: nav.reports, icon: "reports" },
        { href: "/admin/settings", label: nav.settings, icon: "settings" },
      ]}
    >
      {children}
    </Shell>
  );
}
