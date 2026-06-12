/**
 * Drift-guard v2 stamping: records a hash of every EN content section at the
 * moment its RU translation was (re)reviewed. The companion test fails when
 * an EN section changes without re-stamping — key parity alone (v1) can't
 * catch a STALE translation, only a missing one.
 *
 * Run after translating / re-reviewing RU:  node scripts/i18n-stamp.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/** Pull the EN object literal out of a content.ts by brace matching. */
function extractEn(file) {
  const src = readFileSync(resolve(root, "..", file), "utf-8");
  const start = src.indexOf("const en:");
  if (start === -1) throw new Error(`no "const en:" in ${file}`);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") depth--;
    if (depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces in ${file}`);
}

const FILES = [
  "app/[locale]/installation/content.ts",
  "app/[locale]/components/sparkline/content.ts",
  "app/[locale]/components/column-chart/content.ts",
  "messages/en.json",
];

const out = {};
for (const f of FILES) {
  const text = f.endsWith(".json")
    ? readFileSync(resolve(root, "..", f), "utf-8")
    : extractEn(f);
  out[f] = createHash("sha256").update(text).digest("hex").slice(0, 16);
}

writeFileSync(
  resolve(root, "..", "i18n-checksums.json"),
  JSON.stringify(out, null, 2) + "\n",
);
console.log("stamped", Object.keys(out).length, "EN sources");
