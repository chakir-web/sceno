import Link from "next/link";
import { cn } from "@/lib/utils";

export function Button({
  href,
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: string; variant?: "primary" | "ghost" | "light" | "danger" }) {
  const classes = cn("btn", `btn-${variant}`, className);
  if (href) return <Link href={href} className={classes}>{children}</Link>;
  return <button className={classes} {...props}>{children}</button>;
}

export function Badge({ children, tone = "ivory" }: { children: React.ReactNode; tone?: "ivory" | "ink" | "gold" }) {
  const tones = {
    ivory: "border-line bg-ivory text-ink",
    ink: "border-ink bg-ink text-ivory",
    gold: "border-champagne/40 bg-champagne/15 text-ink",
  };
  return <span className={cn("inline-flex items-center border px-2 py-1 text-[11px] uppercase tracking-[0.14em]", tones[tone])}>{children}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-line px-6 py-16 text-center">
      <p className="font-display text-3xl">{title}</p>
      {body ? <p className="mx-auto mt-3 max-w-md text-sm text-stone">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="border border-line bg-ivory p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-stone">{label}</p>
      <p className="mt-3 font-display text-4xl leading-none">{value}</p>
      {hint ? <p className="mt-3 text-sm text-stone">{hint}</p> : null}
    </article>
  );
}

export function PageIntro({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-[11px] uppercase tracking-[0.2em] text-champagne">{eyebrow}</p> : null}
        <h1 className="mt-2 font-display text-4xl md:text-5xl">{title}</h1>
        {body ? <p className="mt-3 max-w-2xl text-sm leading-6 text-stone">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Pagination({ page, total, pageSize, pathname, params }: { page: number; total: number; pageSize: number; pathname: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (next: number) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value) search.set(key, value); });
    search.set("page", String(next));
    return `${pathname}?${search.toString()}`;
  };
  return (
    <nav className="mt-8 flex items-center justify-between text-sm" aria-label="pagination">
      <Link className={cn("btn btn-ghost", page <= 1 && "pointer-events-none opacity-40")} href={href(page - 1)}>←</Link>
      <span>{page} / {pages}</span>
      <Link className={cn("btn btn-ghost", page >= pages && "pointer-events-none opacity-40")} href={href(page + 1)}>→</Link>
    </nav>
  );
}
