"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

/** Copy glyph (founder-supplied) — stroke/currentColor so it themes itself. */
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14.9572 5.47322C14.7283 3.9968 13.6651 3 12.0629 3H6.86577C5.0565 3 3.91992 4.28509 3.91992 6.10048V12.7954C3.91992 14.4491 4.86518 15.6678 6.41498 15.86" />
      <path d="M17.1354 8.11328H11.94C10.1298 8.11328 8.99414 9.39488 8.99414 11.2094V17.9043C8.99414 19.7188 10.1237 21.0004 11.94 21.0004H17.1345C18.9517 21.0004 20.0812 19.7188 20.0812 17.9043V11.2094C20.0812 9.39488 18.9517 8.11328 17.1354 8.11328Z" />
    </svg>
  );
}

export function CopyButton({ text }: { text: string }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={onCopy}
      className="flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
      aria-label={t("copy")}
      title={t("copy")}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-brock-accent" />
      ) : (
        <CopyIcon className="w-4 h-4" />
      )}
    </button>
  );
}
