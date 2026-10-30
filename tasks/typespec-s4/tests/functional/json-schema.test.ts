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

const schemaSpec = (body: string) => `
  import "@typespec/json-schema";
  using JsonSchema;
  @jsonSchema namespace test;
  ${body}
`;

describe("legitimate JSON schema output names keep working", () => {
  it("names each file after its declaration", async () => {
    const project = makeProject("@typespec/json-schema");
    try {
      await runEmitter(project, "@typespec/json-schema", schemaSpec("model Foo { x: string; }"), {
        "file-type": "json",
      });
      assert.deepEqual(files(project.emitterDir, project.base), [
        "out/@typespec/json-schema/Foo.json",
      ]);
    } finally {
      cleanup(project);
    }
  });

  it("keeps dots in a declaration name", async () => {
    const project = makeProject("@typespec/json-schema");
    try {
      await runEmitter(
        project,
        "@typespec/json-schema",
        schemaSpec("model `Pet.Store` { x: string; }"),
        { "file-type": "json" },
      );
      assert.deepEqual(files(project.emitterDir, project.base), [
        "out/@typespec/json-schema/Pet.Store.json",
      ]);
    } finally {
      cleanup(project);
    }
  });

  it("keeps references between generated files pointing at the files produced", async () => {
    const project = makeProject("@typespec/json-schema");
    try {
      await runEmitter(
        project,
        "@typespec/json-schema",
        schemaSpec("model A { b: `Pet.Store`; } model `Pet.Store` { x: string; }"),
        { "file-type": "json" },
      );
      const aPath = path.join(project.emitterDir, "A.json");
      const document = JSON.parse(fs.readFileSync(aPath, "utf8"));
      const reference = document.properties.b.$ref as string;
      assert.equal(typeof reference, "string");
      assert.equal(
        fs.existsSync(path.resolve(path.dirname(aPath), reference)),
        true,
        `reference ${reference} does not point at an emitted file`,
      );
    } finally {
      cleanup(project);
    }
  });

  it("writes the namespace index next to the schemas it lists", async () => {
    const project = makeProject("@typespec/json-schema");
    try {
      await runEmitter(
        project,
        "@typespec/json-schema",
        `
          import "@typespec/json-schema";
          using JsonSchema;
          @jsonSchema namespace \`Pet.Store\`;
          model Foo { x: string; }
        `,
        { "file-type": "json", "output-index": true },
      );
      const indexPath = path.join(project.emitterDir, "Pet.Store", "index.json");
      assert.equal(fs.existsSync(indexPath), true);
      const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      assert.equal(index.namespace, "Pet.Store");
      assert.ok(index.files.includes("Foo.json"));
    } finally {
      cleanup(project);
    }
  });
});
