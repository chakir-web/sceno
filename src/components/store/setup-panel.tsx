import type { Dictionary } from "@/lib/i18n/fr";
import { siteUrl } from "@/lib/utils";

export function SetupPanel({ dict }: { dict: Dictionary }) {
  const steps = [dict.setup.step1, dict.setup.step2, dict.setup.step3, dict.setup.step4, dict.setup.step5, dict.setup.step6.replace("{url}", siteUrl())];
  return (
    <section className="border border-line bg-white/40 p-6 md:p-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-champagne">Supabase</p>
      <h2 className="mt-2 font-display text-4xl">{dict.setup.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-stone">{dict.setup.body}</p>
      <p className="mt-4 text-sm">{dict.setup.noFake}</p>
      <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-stone">{dict.setup.vars}</p>
      <ul className="mt-2 grid gap-1 text-sm">
        <li>NEXT_PUBLIC_SUPABASE_URL</li>
        <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
        <li>SUPABASE_SERVICE_ROLE_KEY</li>
        <li>SCENO_SETUP_TOKEN</li>
        <li>NEXT_PUBLIC_SITE_URL</li>
      </ul>
      <ol className="mt-6 grid gap-2 text-sm">
        {steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}
      </ol>
    </section>
  );
}
