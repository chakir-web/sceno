import type { Metadata } from "next";
import { Suspense } from "react";
import { Cormorant_Garamond, Noto_Sans_Arabic, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { TikTokPixel } from "@/components/tiktok-pixel";
import { getI18n } from "@/lib/i18n/server";
import { tiktokPixelId } from "@/lib/tiktok/config";
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
  const pixelId = tiktokPixelId();
  return (
    <html lang={locale === "ar" ? "ar" : "fr"} dir={direction(locale)} className={`${sans.variable} ${display.variable} ${arabic.variable}`}>
      <head>
        <script
          id="tiktok-pixel"
          dangerouslySetInnerHTML={{
            __html: `!function (w, d, t) {
  if (w.__scenoTiktokPixel) return;
  w.__scenoTiktokPixel='${pixelId}';
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('${pixelId}');
  ttq.page();
}(window, document, 'ttq');`,
          }}
        />
        <script async src="https://www.googletagmanager.com/gtag/js?id=GTM-5T5FMSDM" />
        <script
          dangerouslySetInnerHTML={{
            __html: "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'GTM-5T5FMSDM');",
          }}
        />
      </head>
      <body>
        <Suspense fallback={null}><TikTokPixel /></Suspense>
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:bg-ivory focus:px-3 focus:py-2">{dict.a11y.skip}</a>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
