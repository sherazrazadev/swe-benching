import { describe, it } from "../support/runner.ts";
import { expectEmitterContained } from "../support/harness.ts";

const versioned = (version: string) => `
  import "@typespec/versioning";
  using Versioning;
  @versioned(Versions) @service namespace Service1 {
    enum Versions { v1: ${JSON.stringify(version)} }
  }
`;

describe("emitted OpenAPI documents stay in the emitter output directory", () => {
  it("a version that walks up directories", async () => {
    await expectEmitterContained("@typespec/openapi3", versioned("../../../escaped"), {
      "output-file": "{version}/openapi.yaml",
    });
  });

  it("a version made only of dots", async () => {
    await expectEmitterContained("@typespec/openapi3", versioned(".."), {
      "output-file": "{version}/openapi.yaml",
    });
  });

  it("a version written with windows separators", async () => {
    await expectEmitterContained("@typespec/openapi3", versioned("..\\..\\..\\escaped"), {
      "output-file": "{version}/openapi.yaml",
    });
  });

  it("a version placed in a file name", async () => {
    await expectEmitterContained("@typespec/openapi3", versioned("../../../escaped"), {
      "output-file": "openapi.{version}.yaml",
    });
  });

  it("a service name that walks up directories", async () => {
    await expectEmitterContained(
      "@typespec/openapi3",
      "@service namespace `../../../escaped` {}",
      { "output-file": "{service-name}.yaml" },
    );
  });

  it("a service name made only of dots", async () => {
    await expectEmitterContained("@typespec/openapi3", "@service namespace `..` {}", {
      "output-file": "{service-name}/openapi.yaml",
    });
  });

  it("a service name when several services are emitted", async () => {
    await expectEmitterContained(
      "@typespec/openapi3",
      `
        @service namespace \`../../../escaped\` {}
        @service namespace Service2 {}
      `,
      { "output-file": "openapi.{service-name-if-multiple}.yaml" },
    );
  });
});
