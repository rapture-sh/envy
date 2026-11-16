import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The package's own name as well as `~`, because the examples import it the way a
    // consumer would.
    alias: {
      "@rapture-sh/envy": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    typecheck: {
      include: ["tests/types/**/*.test-d.ts"],
      tsconfig: "./tsconfig.json",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Nothing but re-exports, so it is covered by everything and measures nothing.
      exclude: ["src/index.ts", "src/envy.ts"],
      // A floor rather than a target: set just under what the suite reaches, so a change
      // that drops real coverage fails while a line of error text does not.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
