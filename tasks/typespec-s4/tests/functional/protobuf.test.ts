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

const proto = (name: string) => `
  import "@typespec/protobuf";
  using Protobuf;
  @package({ name: ${JSON.stringify(name)} }) namespace Package1;
  model Message1 { @field(1) a: string; }
`;

describe("legitimate Protobuf output names keep working", () => {
  it("keeps the dotted package layout", async () => {
    const project = makeProject("@typespec/protobuf");
    try {
      await runEmitter(project, "@typespec/protobuf", proto("foo.bar.baz"));
      assert.deepEqual(files(project.emitterDir, project.base), [
        "out/@typespec/protobuf/foo/bar/baz.proto",
      ]);
      const content = fs.readFileSync(
        path.join(project.emitterDir, "foo", "bar", "baz.proto"),
        "utf8",
      );
      assert.ok(content.includes("package foo.bar.baz;"));
    } finally {
      cleanup(project);
    }
  });

  it("writes the package descriptor next to the package output", async () => {
    const project = makeProject("@typespec/protobuf");
    try {
      await runEmitter(project, "@typespec/protobuf", proto("foo.bar.baz"), {
        "emit-descriptor-index": true,
      });
      const descriptorPath = path.join(project.emitterDir, "foo.bar.baz.descriptor.json");
      assert.equal(fs.existsSync(descriptorPath), true);
      const descriptor = JSON.parse(fs.readFileSync(descriptorPath, "utf8"));
      assert.equal(descriptor.package, "foo.bar.baz");
      assert.ok(descriptor.declarations.some((d: { name: string }) => d.name === "Message1"));
    } finally {
      cleanup(project);
    }
  });
});
