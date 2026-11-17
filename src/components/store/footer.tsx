import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import type { Dictionary } from "@/lib/i18n/fr";
import type { StoreSettings } from "@/types/commerce";

export function Footer({ dict, settings }: { dict: Dictionary; settings: StoreSettings | null }) {
  return (
    <footer className="mt-20 bg-ink text-ivory">
      <div className="mx-auto grid max-w-store gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <Logo tone="light" className="h-8 w-auto sm:h-9" />
          <p className="mt-5 max-w-sm text-sm leading-6 text-beige">{dict.footer.tagline}</p>
        </div>
        <div className="text-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-beige">{dict.footer.shop}</p>
          <div className="mt-4 grid gap-2">
            <Link href="/products">{dict.nav.shop}</Link>
            <Link href="/track-order">{dict.footer.track}</Link>
            <Link href="/auth/login">{dict.nav.staff}</Link>
          </div>
        </div>
        <div className="text-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-beige">{dict.footer.contact}</p>
          <div className="mt-4 grid gap-2 text-beige">
            {settings?.supportPhone ? <p>{settings.supportPhone}</p> : <p>{dict.footer.configuredInSettings}</p>}
            {settings?.supportEmail ? <p>{settings.supportEmail}</p> : null}
            {settings?.address ? <p>{settings.address}</p> : null}
            <p>{dict.footer.payment}</p>
            <p>{dict.footer.delivery}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-beige">SCENO · {dict.footer.rights}</div>
    </footer>
  );
}
