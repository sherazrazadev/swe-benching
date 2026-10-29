import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export default {
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.js"],
    silent: false,
  },
  resolve: {
    alias: {
      "open-sse": resolve(here, "../open-sse"),
      "@": resolve(here, "../src"),
    },
  },
};
