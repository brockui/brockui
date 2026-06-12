import { setRequestLocale } from "next-intl/server";
import { localeAlternates } from "@/lib/seo";

export const metadata = {
  alternates: localeAlternates("/"),
};

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <div className="p-10" />;
}
