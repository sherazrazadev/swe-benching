import { describe, it } from "../support/runner.ts";
import { expectEmitterContained } from "../support/harness.ts";

const name = (ident: string) => `
  import "@typespec/json-schema";
  using JsonSchema;
  @jsonSchema namespace test;
  model \`${ident}\` {}
`;

describe("emitted JSON schemas stay in the emitter output directory", () => {
  it("a declaration name that walks up directories", async () => {
    await expectEmitterContained("@typespec/json-schema", name("../../../escaped"), {
      "file-type": "json",
    });
  });

  it("a declaration name placed next to another declaration", async () => {
    await expectEmitterContained(
      "@typespec/json-schema",
      `
        import "@typespec/json-schema";
        using JsonSchema;
        @jsonSchema namespace test;
        model A { b: \`../../../escaped\`; }
        model \`../../../escaped\` { x: string; }
      `,
      { "file-type": "json" },
    );
  });
});
