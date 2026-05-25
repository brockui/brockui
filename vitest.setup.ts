import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Auto-cleanup the React Testing Library DOM after each test.
// Required when vitest globals: false (we set it in vitest.config.ts).
afterEach(() => {
  cleanup();
});
