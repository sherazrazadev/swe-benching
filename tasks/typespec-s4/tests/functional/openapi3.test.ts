import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parse } from "yaml";
import { describe, it } from "../support/runner.ts";
import { cleanup, makeProject, runEmitter, walk } from "../support/harness.ts";

function emittedFiles(emitterDir: string, base: string): string[] {
  return walk(emitterDir)
    .filter((entry) => fs.statSync(entry).isFile())
    .map((entry) => path.relative(base, entry).split(path.sep).join("/"));
}

const versioned = (namespace: string, version: string) => `
  import "@typespec/versioning";
  using Versioning;
  @versioned(Versions) @service namespace ${namespace} {
    enum Versions { v1: ${JSON.stringify(version)} }
  }
`;

describe("legitimate OpenAPI output names keep working", () => {
  it("keeps dotted service and version names unchanged", async () => {
    const project = makeProject("@typespec/openapi3");
    try {
      await runEmitter(project, "@typespec/openapi3", versioned("Pet.Store", "2021-10-01-preview"), {
        "output-file": "{service-name}.{version}.yaml",
      });
      assert.deepEqual(emittedFiles(project.emitterDir, project.base), [
        "out/@typespec/openapi3/Pet.Store.2021-10-01-preview.yaml",
      ]);
      const document = parse(
        fs.readFileSync(
          path.join(project.emitterDir, "Pet.Store.2021-10-01-preview.yaml"),
          "utf8",
        ),
      );
      assert.equal(document.openapi, "3.0.0");
    } finally {
      cleanup(project);
    }
  });

  it("keeps a version used as a directory", async () => {
    const project = makeProject("@typespec/openapi3");
    try {
      await runEmitter(project, "@typespec/openapi3", versioned("Service1", "1.0.0"), {
        "output-file": "{version}/openapi.yaml",
      });
      assert.deepEqual(emittedFiles(project.emitterDir, project.base), [
        "out/@typespec/openapi3/1.0.0/openapi.yaml",
      ]);
    } finally {
      cleanup(project);
    }
  });

  it("keeps names that begin or end with dots", async () => {
    for (const [version, expected] of [
      ["..dir", "..dir.yaml"],
      ["dir..", "dir...yaml"],
    ] as const) {
      const project = makeProject("@typespec/openapi3");
      try {
        await runEmitter(project, "@typespec/openapi3", versioned("Service1", version), {
          "output-file": "{version}.yaml",
        });
        assert.deepEqual(emittedFiles(project.emitterDir, project.base), [
          `out/@typespec/openapi3/${expected}`,
        ]);
      } finally {
        cleanup(project);
      }
    }
  });

  it("emits one document per service when several services are present", async () => {
    const project = makeProject("@typespec/openapi3");
    try {
      await runEmitter(
        project,
        "@typespec/openapi3",
        `
          @service namespace Service1 {}
          @service namespace Service2 {}
        `,
        { "output-file": "openapi.{service-name-if-multiple}.yaml" },
      );
      assert.deepEqual(emittedFiles(project.emitterDir, project.base).sort(), [
        "out/@typespec/openapi3/openapi.Service1.yaml",
        "out/@typespec/openapi3/openapi.Service2.yaml",
      ]);
    } finally {
      cleanup(project);
    }
  });
});
