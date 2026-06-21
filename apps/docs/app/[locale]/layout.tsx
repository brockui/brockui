import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "../globals.css";
import { Sidebar } from "@/components/chrome/sidebar";
import { Header } from "@/components/chrome/header";
import { Footer } from "@/components/chrome/footer";
import { LocaleNotice } from "@/components/chrome/locale-notice";

const geistSans = Geist({
  variable: "--font-geist-sans",
  // "cyrillic" affects PRELOAD only (all unicode-range subsets always load
  // on demand) — without it, RU pages flash a fallback font first.
  subsets: ["latin", "cyrillic"],
});

const hack = localFont({
  variable: "--font-hack",
  display: "swap",
  src: [
    { path: "../fonts/hack/Hack-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/hack/Hack-Italic.ttf", weight: "400", style: "italic" },
    { path: "../fonts/hack/Hack-Bold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/hack/Hack-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
});

const departureMono = localFont({
  variable: "--font-departure-mono",
  display: "swap",
  src: "../fonts/departure-mono/DepartureMono-Regular.woff2",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: "Brock UI – editable React components for charts and data",
  description:
    "Editable, open-source React components for charts and data, installable straight from the shadcn registry. Built on the Tufte and Financial Times data-visualization canon.",
};

// Runs synchronously in <head> before React hydrates to prevent
// "flash of wrong theme" (FOUC). Modes: 'light' | 'dark' | 'system'.
// Default (nothing stored): light — the brand is light-first. 'system'
// follows prefers-color-scheme.
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('brockui-theme');
    var dark = stored === 'dark' ||
      (stored === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) { /* localStorage unavailable */ }
})();
`;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${hack.variable} ${departureMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <Header />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="min-w-0 flex-1 overflow-auto">
              <div className="flex min-h-full flex-col">
                <div className="flex-1">{children}</div>
                <Footer />
              </div>
            </main>
          </div>
          <LocaleNotice />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
