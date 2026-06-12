import type { ReactNode } from "react";

/**
 * Minimal rich-text model for bilingual page content. Prose lives in typed
 * per-page dictionaries (content.ts) as arrays of segments; inline technical
 * tokens stay marked as `{ code }` so they render in mono and are NEVER
 * translated (prop names, commands, file names — see docs/glossary-ru.md).
 *
 * Why not JSX in dictionaries: typed plain data keeps EN/RU structurally
 * identical (TypeScript = drift-guard v1: a missing RU field is a compile
 * error), serializes for the hash freshness guard (v2), and can't drift in
 * markup.
 */
export type Rich = ReadonlyArray<string | { code: string }>;

export function RichText({ segments }: { segments: Rich }) {
  return (
    <>
      {segments.map((seg, i) =>
        typeof seg === "string" ? (
          seg
        ) : (
          <code key={i} className="font-mono text-xs text-foreground">
            {seg.code}
          </code>
        ),
      )}
    </>
  );
}

export function richToString(segments: Rich): string {
  return segments
    .map((s) => (typeof s === "string" ? s : s.code))
    .join("");
}
