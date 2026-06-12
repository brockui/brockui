import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. ALL internal links in the app must use
 * this `Link` (not next/link) so navigation from /ru pages stays inside /ru.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
