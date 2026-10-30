/// <reference types="vitest" />
// Verifier runner configuration: the project's TypeScript sources (including the compiled
// pages modules) are transformed with SWC only. The project's default config also installs the
// Preact Vite preset, whose Babel helper is resolved from the workspace root and is not needed
// for these suites.
import { defineConfig } from "vite"
import swc from "unplugin-swc"

export default defineConfig({
  test: {
    // NOTE: `.spec` is reserved for Playwright tests
    include: ["**/*.test.?(c|m)[jt]s?(x)"],
    setupFiles: ["../utils/vitest-setup.ts"],
  },
  plugins: [swc.vite()],
})
