import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "../support/runner.ts";
import { cleanup, expectAssetContained, makeAssetProject } from "../support/harness.ts";

describe("legitimate source file paths keep working", () => {
  it("writes a plain file inside the output directory", async () => {
    const project = await makeAssetProject();
    try {
      await project.emit("output.ts", "plain");
      assert.ok(fs.readFileSync(path.join(project.out, "output.ts"), "utf8").includes("plain"));
      expectAssetContained(project);
    } finally {
      cleanup(project);
    }
  });

  it("keeps sub-directories", async () => {
    const project = await makeAssetProject();
    try {
      await project.emit("src/models/a.ts", "nested");
      assert.ok(
        fs
          .readFileSync(path.join(project.out, "src", "models", "a.ts"), "utf8")
          .includes("nested"),
      );
      expectAssetContained(project);
    } finally {
      cleanup(project);
    }
  });

  it("keeps dots in a file name", async () => {
    const project = await makeAssetProject();
    try {
      await project.emit("Pet.Store.ts", "dotted");
      assert.ok(fs.readFileSync(path.join(project.out, "Pet.Store.ts"), "utf8").includes("dotted"));
      expectAssetContained(project);
    } finally {
      cleanup(project);
    }
  });

  it("keeps a name that begins with dots as a relative file name", async () => {
    const project = await makeAssetProject();
    try {
      await project.emit("..dir.ts", "leading");
      assert.ok(fs.readFileSync(path.join(project.out, "..dir.ts"), "utf8").includes("leading"));
      expectAssetContained(project);
    } finally {
      cleanup(project);
    }
  });
});
