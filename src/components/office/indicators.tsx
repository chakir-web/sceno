import {
  AlertTriangle,
  Ban,
  Banknote,
  CalendarClock,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  Info,
  Minus,
  Package,
  PackageCheck,
  PackageX,
  Phone,
  PhoneOff,
  RotateCcw,
  Sparkles,
  Star,
  Tag,
  Truck,
  Undo2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { statusLabel } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

export type OfficeTone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";
type StatusKind = "confirmation" | "shipment" | "payment";

const pillTone: Record<OfficeTone, string> = {
  success: "border-office-success-line bg-office-success-soft text-office-success",
  warning: "border-office-warning-line bg-office-warning-soft text-office-warning",
  danger: "border-office-danger-line bg-office-danger-soft text-office-danger",
  info: "border-office-info-line bg-office-info-soft text-office-info",
  neutral: "border-office-neutral-line bg-office-neutral-soft text-office-neutral",
  accent: "border-office-accent-line bg-office-accent-soft text-office-accent",
};

const rule: Record<OfficeTone, string> = {
  success: "border-s-office-success",
  warning: "border-s-office-warning",
  danger: "border-s-office-danger",
  info: "border-s-office-info",
  neutral: "border-s-office-neutral",
  accent: "border-s-office-accent",
};

const confirmationTone: Record<string, OfficeTone> = {
  new: "info",
  confirming: "warning",
  confirmed: "success",
  cancelled: "danger",
  unreachable: "warning",
};

const shipmentTone: Record<string, OfficeTone> = {
  pending: "warning",
  prepared: "info",
  shipped: "info",
  in_transit: "info",
  delivered: "success",
  absent: "warning",
  postponed: "warning",
  refused: "danger",
  returned: "danger",
};

const paymentTone: Record<string, OfficeTone> = {
  pending: "neutral",
  collected: "success",
  reversed: "danger",
};

const confirmationIcon: Record<string, LucideIcon> = {
  new: Sparkles,
  confirming: Phone,
  confirmed: Check,
  cancelled: CircleAlert,
  unreachable: PhoneOff,
};

const shipmentIcon: Record<string, LucideIcon> = {
  pending: Clock,
  prepared: Package,
  shipped: Truck,
  in_transit: Truck,
  delivered: PackageCheck,
  absent: UserX,
  postponed: CalendarClock,
  refused: Ban,
  returned: Undo2,
};

const paymentIcon: Record<string, LucideIcon> = {
  pending: Clock,
  collected: Banknote,
  reversed: RotateCcw,
};

export function statusTone(kind: StatusKind, status: string): OfficeTone {
  const table = kind === "confirmation" ? confirmationTone : kind === "shipment" ? shipmentTone : paymentTone;
  return table[status] ?? "neutral";
}

function statusIcon(kind: StatusKind, status: string) {
  const table = kind === "confirmation" ? confirmationIcon : kind === "shipment" ? shipmentIcon : paymentIcon;
  return table[status] ?? Info;
}

export function stockLevel(quantity: number, threshold: number) {
  if (quantity <= 0) return "out" as const;
  if (threshold > 1 && quantity === 1) return "critical" as const;
  if (threshold > 0 && quantity <= threshold) return "low" as const;
  return "ok" as const;
}

export function Pill({ tone, icon: Icon, children }: { tone: OfficeTone; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5 border px-2 py-1 text-[11px] font-medium leading-4", pillTone[tone])}>
      {Icon ? <Icon size={12} aria-hidden="true" className="shrink-0" /> : null}
      <span className="min-w-0 whitespace-normal">{children}</span>
    </span>
  );
}

export function StatusPill({ locale, kind, status }: { locale: Locale; kind: StatusKind; status: string }) {
  const Icon = statusIcon(kind, status);
  return <Pill tone={statusTone(kind, status)} icon={Icon}>{statusLabel(locale, kind, status)}</Pill>;
}

export function StockPill({
  quantity,
  threshold,
  labels,
}: {
  quantity: number;
  threshold: number;
  labels: { ok: string; low: string; critical: string; out: string };
}) {
  const level = stockLevel(quantity, threshold);
  const tone = level === "ok" ? "success" : level === "low" ? "warning" : "danger";
  const icon = level === "ok" ? Check : level === "low" ? AlertTriangle : level === "out" ? PackageX : AlertTriangle;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="tabular-nums">{quantity}</span>
      <Pill tone={tone} icon={icon}>{labels[level]}</Pill>
    </span>
  );
}

export function StatePill({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return <Pill tone={active ? "success" : "neutral"} icon={active ? Check : Minus}>{active ? activeLabel : inactiveLabel}</Pill>;
}

export function PromoPill({ children }: { children: React.ReactNode }) {
  return <Pill tone="accent" icon={Tag}>{children}</Pill>;
}

export function FeaturedPill({ children }: { children: React.ReactNode }) {
  return <Pill tone="info" icon={Star}>{children}</Pill>;
}

export function Notice({ tone, children }: { tone: "success" | "warning" | "danger" | "info"; children: React.ReactNode }) {
  const Icon = tone === "success" ? CircleCheck : tone === "warning" ? AlertTriangle : tone === "danger" ? CircleAlert : Info;
  return (
    <p className={cn("flex items-start gap-2 border px-3 py-2 text-sm leading-5", pillTone[tone])}>
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function OfficeStat({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: OfficeTone;
  icon: LucideIcon;
}) {
  return (
    <article className={cn("min-w-0 border border-line border-s-2 bg-ivory p-4", rule[tone])}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone">{label}</p>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center border", pillTone[tone])}>
          <Icon size={15} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 break-words font-sans text-2xl font-medium tabular-nums tracking-tight text-ink sm:text-3xl">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-5 text-stone">{hint}</p> : null}
    </article>
  );
}
