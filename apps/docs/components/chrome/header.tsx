import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";
import { ThemeSwitcher } from "./theme-switcher";
import { LocaleSwitcher } from "./locale-switcher";

export function Header() {
  const t = useTranslations("chrome");
  return (
    <header className="sticky top-0 z-50 flex h-15 min-h-15 w-full items-center gap-4 border-b border-border bg-background px-3 md:px-6">
      <Link
        href="/"
        aria-label={t("homeAria")}
        className="flex shrink-0 items-center"
      >
        <Logo variant="lockup" className="h-5 w-auto text-foreground" />
      </Link>
      <div className="w-full max-w-sm">
        <HeaderSearch />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <LocaleSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
