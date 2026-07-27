const nextJest = require("next/jest");

// next/jest auto-configures SWC transforms and tsconfig path aliases (@/*)
// so tests can import the exact same modules the app does, with zero extra
// transform config — the right fit for a Next.js 14 App Router project
// over a hand-rolled ts-jest setup.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  // Pure-logic unit tests only (see README's testing section) — no React
  // components are under test here, so the lighter/faster node environment
  // is correct; jsdom is next/jest's default and would only add overhead.
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};

module.exports = createJestConfig(customJestConfig);
