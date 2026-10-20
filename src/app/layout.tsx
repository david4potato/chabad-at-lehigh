import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OG_IMAGE, SITE } from "@/config/site";
import { getSiteUrl } from "@/lib/env";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  // No og:title or og:description here: link previews then use each page's own title and description.
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_US",
    images: [OG_IMAGE],
  },
  // No title or description here, so event pages keep their own; chats fall back to the og: tags.
  twitter: { card: "summary_large_image", images: [OG_IMAGE] },
  robots: SITE.listInSearchEngines ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fffaf2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:shadow"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 md:px-8">{children}</div>
        </main>
        <div className="pb-safe-nav print:hidden">
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
