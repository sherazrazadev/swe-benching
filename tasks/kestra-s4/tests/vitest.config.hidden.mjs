// Verifier-side Vitest configuration. It is copied into the restored workspace at grading
// time and does not depend on the submission's own test configuration.
import {defineConfig} from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

const stub = path.resolve(process.cwd(), "node_modules/@kestra-io/ui-libs/stub-mdc-imports.js");

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            override: path.resolve(process.cwd(), "src/override"),
            "#imports": stub,
            "#build/mdc-image-component.mjs": stub,
            "#mdc-imports": stub,
            "#mdc-configs": stub,
        },
    },
    test: {
        environment: "jsdom",
        include: ["tests/hidden/**/*.spec.ts"],
        reporters: ["default"],
    },
});
