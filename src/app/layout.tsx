import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans_Arabic, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { getI18n } from "@/lib/i18n/server";
import { direction } from "@/lib/i18n/locales";
import { siteUrl } from "@/lib/utils";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display" });
const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600"], variable: "--font-arabic" });

export async function generateMetadata(): Promise<Metadata> {
  const { locale, dict } = await getI18n();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: dict.meta.title, template: "%s — SCENO" },
    description: dict.meta.description,
    applicationName: "SCENO",
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      siteName: "SCENO",
      locale: locale === "ar" ? "ar_MA" : "fr_MA",
      type: "website",
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getI18n();
  return (
    <html lang={locale === "ar" ? "ar" : "fr"} dir={direction(locale)} className={`${sans.variable} ${display.variable} ${arabic.variable}`}>
      <body>
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:bg-ivory focus:px-3 focus:py-2">{dict.a11y.skip}</a>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
