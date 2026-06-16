"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";

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
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
