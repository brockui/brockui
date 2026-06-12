import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import checksums from "./i18n-checksums.json";
import enMessages from "./messages/en.json";
import ruMessages from "./messages/ru.json";

/**
 * i18n drift guards (canon: a stale translation lies louder than a missing one).
 *
 * v1 — key parity: every EN message key exists in RU and vice versa.
 *      (Typed content.ts modules get v1 for free from TypeScript.)
 * v2 — freshness: a hash of each EN source is stamped at RU-review time
 *      (scripts/i18n-stamp.mjs). EN changed without re-stamping → red CI →
 *      someone must re-review the Russian before shipping.
 */

function keysOf(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === "object"
      ? keysOf(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("i18n drift guard v1 — message key parity", () => {
  it("ru.json covers every en.json key (and nothing extra)", () => {
    const en = keysOf(enMessages).sort();
    const ru = keysOf(ruMessages).sort();
    expect(ru).toEqual(en);
  });
});

function extractEn(file: string): string {
  const src = readFileSync(resolve(__dirname, file), "utf-8");
  const start = src.indexOf("const en:");
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") depth--;
    if (depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces in ${file}`);
}

describe("i18n drift guard v2 — EN freshness hashes", () => {
  for (const [file, stamped] of Object.entries(checksums)) {
    it(`RU is current for ${file}`, () => {
      const text = file.endsWith(".json")
        ? readFileSync(resolve(__dirname, file), "utf-8")
        : extractEn(file);
      const actual = createHash("sha256")
        .update(text)
        .digest("hex")
        .slice(0, 16);
      expect(
        actual,
        `EN content in ${file} changed since the RU translation was last reviewed. ` +
          `Re-review the Russian text, then re-stamp: node scripts/i18n-stamp.mjs`,
      ).toBe(stamped);
    });
  }
});
