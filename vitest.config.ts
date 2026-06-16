import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/pipeline/**",
        "lib/optimizer/**",
        "lib/captain/**",
        "lib/plan/**",
      ],
      // Regression floor, set just below achieved coverage (lines ~97, stmts ~93,
      // funcs ~95, branches ~82). Branches sits below the others because the
      // remaining uncovered arms are defensive (nullish fallbacks, catch blocks)
      // with low marginal value; the floor still fails CI on real regressions.
      thresholds: {
        lines: 92,
        branches: 80,
        functions: 90,
        statements: 90,
      },
    },
  },
});
