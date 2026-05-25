import Link from "next/link";
import { HeaderSearch } from "./header-search";
import { Logo } from "./logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-15 min-h-15 w-full items-center gap-4 border-b border-white/10 bg-background px-3 md:px-6">
      <Link
        href="/"
        aria-label="Brock UI home"
        className="flex shrink-0 items-center"
      >
        <Logo variant="lockup" className="h-5 w-auto text-foreground" />
      </Link>
      <div className="w-full max-w-sm">
        <HeaderSearch />
      </div>
    </header>
  );
}
