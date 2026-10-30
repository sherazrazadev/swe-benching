import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "../support/runner.ts";
import { cleanup, makeProject, runEmitter, walk } from "../support/harness.ts";

function files(emitterDir: string, base: string): string[] {
  return walk(emitterDir)
    .filter((entry) => fs.statSync(entry).isFile())
    .map((entry) => path.relative(base, entry).split(path.sep).join("/"));
}

const schema = (name: string) => `
  import "@typespec/graphql";
  using TypeSpec.GraphQL;
  @schema(#{ name: ${JSON.stringify(name)} }) namespace Test {
    model User { name: string; }
    @query op getUser(): User;
  }
`;

describe("legitimate GraphQL output names keep working", () => {
  it("keeps dots in the schema name", async () => {
    const project = makeProject("@typespec/graphql");
    try {
      await runEmitter(project, "@typespec/graphql", schema("Pet.Store"));
      assert.deepEqual(files(project.emitterDir, project.base), [
        "out/@typespec/graphql/Pet.Store.graphql",
      ]);
      const sdl = fs.readFileSync(path.join(project.emitterDir, "Pet.Store.graphql"), "utf8");
      assert.ok(sdl.includes("type Query"));
      assert.ok(sdl.includes("getUser"));
    } finally {
      cleanup(project);
    }
  });

  it("keeps a schema name used as a directory", async () => {
    const project = makeProject("@typespec/graphql");
    try {
      await runEmitter(project, "@typespec/graphql", schema("Pet.Store"), {
        "output-file": "{schema-name}/schema.graphql",
      });
      assert.deepEqual(files(project.emitterDir, project.base), [
        "out/@typespec/graphql/Pet.Store/schema.graphql",
      ]);
    } finally {
      cleanup(project);
    }
  });
});
