import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";
import { GithubIcon } from "./icons";
import { ThemeSwitcher } from "./theme-switcher";
import { LocaleSwitcher } from "./locale-switcher";

const GITHUB_URL = "https://github.com/brockui/brockui";

export function Header() {
  const t = useTranslations("chrome");
  return (
    <header className="sticky top-0 z-50 flex h-12 min-h-12 w-full items-center gap-3 border-b border-border bg-background px-3 md:px-5">
      <Link
        href="/"
        aria-label={t("homeAria")}
        className="flex shrink-0 items-center"
      >
        <Logo variant="lockup" className="h-[18px] w-auto text-foreground" />
      </Link>
      <div className="min-w-0 flex-1 max-w-xs">
        <HeaderSearch />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("githubAria")}
          title={t("githubAria")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-brock-accent/40"
        >
          <GithubIcon className="h-3.5 w-3.5" />
        </a>
        <LocaleSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
