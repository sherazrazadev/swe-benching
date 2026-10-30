import { describe, it } from "../support/runner.ts";
import { expectEmitterContained } from "../support/harness.ts";

const namespace = (name: string) => `
  import "@typespec/json-schema";
  using JsonSchema;
  @jsonSchema namespace \`${name}\`;
  model Foo { x: string; }
`;

describe("the emitted schema index stays in the emitter output directory", () => {
  it("a namespace that walks up directories", async () => {
    await expectEmitterContained("@typespec/json-schema", namespace("../../../escaped"), {
      "file-type": "json",
      "output-index": true,
    });
  });

  it("a namespace made only of dots", async () => {
    await expectEmitterContained("@typespec/json-schema", namespace(".."), {
      "file-type": "json",
      "output-index": true,
    });
  });

});
