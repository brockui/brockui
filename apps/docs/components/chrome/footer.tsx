import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";

const GITHUB_URL = "https://github.com/brockui/brockui";
const PHONE = "+7 702 829 09 08";
const EMAIL = "almas@kasymzhanov.com";

/** Site footer: wordmark + what-it-is, a hairline, then copyright and contacts
 *  on the left with useful links on the right. Mirrors the kasymzhanov.com
 *  colophon, tuned to the Brock UI chrome. */
export function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
        <Logo variant="lockup" className="h-6 w-auto text-foreground" />

        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("description")}
        </p>
        <p className="mt-3 text-xs text-muted-foreground/70">{t("colophon")}</p>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div>© 2026 Brock UI · Almas Kasymzhanov</div>
            <div>
              <a
                href={`tel:${PHONE.replace(/\s/g, "")}`}
                className="transition-colors hover:text-foreground"
              >
                {PHONE}
              </a>
              {" · "}
              <a
                href={`mailto:${EMAIL}`}
                className="transition-colors hover:text-foreground"
              >
                {EMAIL}
              </a>
            </div>
          </div>

          <nav className="flex items-center gap-5">
            <Link
              href="/components/column-chart"
              className="transition-colors hover:text-foreground"
            >
              {t("components")}
            </Link>
            <Link
              href="/installation"
              className="transition-colors hover:text-foreground"
            >
              {t("installation")}
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
