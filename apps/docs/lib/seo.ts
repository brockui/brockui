import type { Metadata } from "next";

/**
 * hreflang alternates for a page. `x-default` points at EN (the unprefixed
 * canonical) — search engines send users with unmatched languages there.
 */
export function localeAlternates(path: string): Metadata["alternates"] {
  const en = path === "/" ? "/" : path;
  const ru = path === "/" ? "/ru" : `/ru${path}`;
  return {
    languages: {
      en,
      ru,
      "x-default": en,
    },
  };
}
