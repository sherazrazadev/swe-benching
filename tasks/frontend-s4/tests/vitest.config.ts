import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    env: {
      TZ: "Etc/UTC",
      IS_TEST: "true",
    },
    setupFiles: ["/opt/frontend/__verifier__/setup.ts"],
    include: ["__verifier__/**/*.test.ts", "test/**/*.test.ts"],
  },
});
