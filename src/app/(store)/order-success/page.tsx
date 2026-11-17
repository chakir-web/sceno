import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ number?: string }> }) {
  const { number } = await searchParams;
  const { dict } = await getI18n();
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-champagne">SCENO</p>
      <h1 className="mt-4 font-display text-5xl">{dict.success.title}</h1>
      <p className="mt-4 text-sm leading-6 text-stone">{dict.success.lead}</p>
      {number ? <p className="mt-8 border border-line py-6 font-display text-4xl">{number}</p> : null}
      <p className="mt-4 text-sm">{dict.success.cod}</p>
      <p className="mt-2 text-sm text-stone">{dict.success.keep}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link className="btn btn-primary" href={`/track-order?number=${encodeURIComponent(number ?? "")}`}>{dict.success.track}</Link>
        <Link className="btn btn-ghost" href="/">{dict.success.home}</Link>
      </div>
    </div>
  );
}
