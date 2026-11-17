"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Boxes, FolderTree, LayoutDashboard, LogOut, Menu, Package, Settings, ShoppingBag, Truck, Users, UserRound, Warehouse, X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { signOut } from "@/lib/actions/auth";
import type { Dictionary } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const icons = {
  dashboard: LayoutDashboard,
  products: Package,
  categories: FolderTree,
  inventory: Warehouse,
  orders: ShoppingBag,
  customers: Users,
  confirmers: UserRound,
  shipments: Truck,
  carriers: Truck,
  reports: BarChart3,
  settings: Settings,
  history: Boxes,
};

export function Shell({
  dict,
  area,
  name,
  logoutLabel,
  items,
  children,
}: {
  dict: Dictionary;
  area: string;
  name: string;
  logoutLabel: string;
  items: { href: string; label: string; icon: keyof typeof icons; badge?: number }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <div className="flex h-full flex-col">
      <Link href="/" className="block px-5 py-6"><Logo className="h-8 w-auto" /></Link>
      <p className="px-5 text-[11px] uppercase tracking-[0.18em] text-champagne">{area}</p>
      <nav className="mt-4 grid gap-1 px-3">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-3 py-2.5 text-sm outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne", active ? "bg-ink text-ivory" : "hover:bg-mist")}>
              <Icon size={16} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge ? <span className={cn("ms-auto grid h-5 min-w-5 place-items-center border px-1 text-[10px] tabular-nums", active ? "border-ivory bg-ivory text-ink" : "border-office-warning-line bg-office-warning-soft text-office-warning")}>{item.badge}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-line p-4">
        <p className="truncate text-sm">{name || dict.nav.staff}</p>
        <form action={signOut}>
          <button className="mt-3 flex items-center gap-2 text-sm text-stone" type="submit"><LogOut size={15} />{logoutLabel}</button>
        </form>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-[#f7f4ee] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen border-e border-line bg-ivory lg:block">{nav}</aside>
      <div>
        <div className="no-print flex items-center justify-between border-b border-line bg-ivory px-4 py-3 lg:hidden">
          <button aria-label={dict.a11y.openMenu} onClick={() => setOpen(true)}><Menu /></button>
          <Logo className="h-7 w-auto" />
          <span />
        </div>
        {open ? <div className="fixed inset-0 z-50 bg-ink/30 lg:hidden" onClick={() => setOpen(false)}><div className="h-full w-[280px] bg-ivory" onClick={(event) => event.stopPropagation()}><button className="absolute end-4 top-4" onClick={() => setOpen(false)} aria-label={dict.a11y.close}><X /></button>{nav}</div></div> : null}
        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
