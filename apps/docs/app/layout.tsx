import type { Metadata } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Sidebar } from "@/components/chrome/sidebar";
import { Header } from "@/components/chrome/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const hack = localFont({
  variable: "--font-hack",
  display: "swap",
  src: [
    { path: "./fonts/hack/Hack-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/hack/Hack-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/hack/Hack-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/hack/Hack-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
});

const departureMono = localFont({
  variable: "--font-departure-mono",
  display: "swap",
  src: "./fonts/departure-mono/DepartureMono-Regular.woff2",
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: "Brock UI — opinionated React components for data & AI products",
  description:
    "Micrographics-first, density-with-discipline, monospace where data lives.",
};

// Runs synchronously in <head> before React hydrates to prevent
// "flash of wrong theme" (FOUC). Default: light. Honors localStorage.
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('brockui-theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) { /* localStorage unavailable */ }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${hack.variable} ${departureMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
