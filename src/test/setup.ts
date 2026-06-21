import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Ensure the DOM is reset between tests so component trees don't leak across cases.
afterEach(() => {
  cleanup();
});
