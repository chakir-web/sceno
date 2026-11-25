import { Suspense } from "react";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { MetaPixel } from "@/components/store/meta-pixel";
import { WhatsAppWidget } from "@/components/store/whatsapp-widget";
import { getI18n } from "@/lib/i18n/server";
import { listCategories } from "@/lib/services/catalog";
import { getSettings } from "@/lib/services/settings";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getI18n();
  const [categories, settings] = await Promise.all([listCategories(locale), getSettings()]);
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <p className="bg-ink px-4 py-2 text-center text-[11px] uppercase tracking-[0.22em] text-ivory">{dict.home.banner}</p>
      <Header locale={locale} dict={dict} categories={categories.data} />
      <Suspense fallback={null}><MetaPixel /></Suspense>
      <main id="contenu" className="mx-auto w-full max-w-store flex-1 px-4 py-8 md:px-6 md:py-12">{children}</main>
      <Footer dict={dict} settings={settings.data} />
      <WhatsAppWidget label={dict.direct.whatsapp} />
    </div>
  );
}
