import { describe, it } from "../support/runner.ts";
import { expectEmitterContained } from "../support/harness.ts";

const schema = (name: string) => `
  import "@typespec/graphql";
  using TypeSpec.GraphQL;
  @schema(#{ name: ${JSON.stringify(name)} }) namespace Test {
    model User { name: string; }
    @query op getUser(): User;
  }
`;

describe("emitted GraphQL schemas stay in the emitter output directory", () => {
  it("a schema name that walks up directories", async () => {
    await expectEmitterContained("@typespec/graphql", schema("../../../escaped"));
  });

  it("a schema name made only of dots", async () => {
    await expectEmitterContained("@typespec/graphql", schema(".."), {
      "output-file": "{schema-name}/schema.graphql",
    });
  });

  it("a schema name written with windows separators", async () => {
    await expectEmitterContained("@typespec/graphql", schema("..\\..\\..\\escaped"));
  });

  it("a schema name placed in a directory", async () => {
    await expectEmitterContained("@typespec/graphql", schema("../../../escaped"), {
      "output-file": "{schema-name}/schema.graphql",
    });
  });
});
