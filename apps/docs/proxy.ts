import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next 16 "proxy" convention (the artist formerly known as middleware).
export default createMiddleware(routing);

export const config = {
  // Locale-route everything EXCEPT:
  //  - /r/*       — the shadcn registry endpoints (part of the prod contract;
  //                 must never be rewritten or localized)
  //  - /_next, /_vercel — framework internals
  //  - any path with a dot (static files: icon.svg, *.json, fonts…)
  matcher: ["/((?!r/|_next|_vercel|.*\\..*).*)"],
};
