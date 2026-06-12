import { defineRouting } from "next-intl/routing";

/**
 * Locale routing config.
 *
 * - `en` is the default and lives UNPREFIXED at the root (existing URLs —
 *   brockui.com/components/column-chart — keep working and keep their SEO).
 * - `ru` lives under /ru.
 * - `localeDetection: false` — content is always served by URL, never by
 *   Accept-Language redirect (Googlebot crawls with EN headers and would
 *   never discover /ru; a user clicking a RU link must get the RU page).
 *   Language discovery happens via the header switcher + a soft banner.
 *
 * Adding a locale (e.g. `kk` for Kazakh — part of the long-term audience
 * strategy) = add it here and provide messages/<locale>.json + per-page
 * content entries. Nothing else is hardcoded to two languages.
 */
export const routing = defineRouting({
  locales: ["en", "ru"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
