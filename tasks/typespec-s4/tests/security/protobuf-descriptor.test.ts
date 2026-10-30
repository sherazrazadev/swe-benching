import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "../support/runner.ts";
import { cleanup, expectContained, makeProject, runEmitter } from "../support/harness.ts";

function absoluteTarget() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ts4-"));
  return { dir, name: path.join(dir, "escaped") };
}

const proto = (name: string) => `
  import "@typespec/protobuf";
  using Protobuf;
  @package({ name: ${JSON.stringify(name)} }) namespace Package1;
  model Message1 { @field(1) a: string; }
`;

describe("the emitted package descriptor stays in the emitter output directory", () => {
  it("a package name that is an absolute path", async () => {
    const target = absoluteTarget();
    const project = makeProject("@typespec/protobuf");
    try {
      await runEmitter(project, "@typespec/protobuf", proto(target.name), {
        "emit-descriptor-index": true,
      });
      assert.equal(
        fs.existsSync(`${target.name}.descriptor.json`),
        false,
        "a descriptor was written outside the emitter output directory",
      );
      expectContained(project);
    } finally {
      cleanup(project);
      fs.rmSync(target.dir, { recursive: true, force: true });
    }
  });

  it("a package name that is an absolute path with windows separators", async () => {
    const target = absoluteTarget();
    const project = makeProject("@typespec/protobuf");
    try {
      const name = target.name.split("/").join("\\");
      await runEmitter(project, "@typespec/protobuf", proto(name), {
        "emit-descriptor-index": true,
      });
      assert.equal(
        fs.existsSync(`${target.name}.descriptor.json`),
        false,
        "a descriptor was written outside the emitter output directory",
      );
      expectContained(project);
    } finally {
      cleanup(project);
      fs.rmSync(target.dir, { recursive: true, force: true });
    }
  });
});
