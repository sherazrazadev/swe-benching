import path from "node:path";
import { describe, it } from "../support/runner.ts";
import { cleanup, expectAssetContained, makeAssetProject } from "../support/harness.ts";

async function emitAndCheck(name: (project: { base: string }) => string) {
  const project = await makeAssetProject();
  try {
    await project.emit(name(project));
    expectAssetContained(project);
  } finally {
    cleanup(project);
  }
}

describe("source files created through the asset emitter stay in the emitter output directory", () => {
  it("a relative path that walks up directories", async () => {
    await emitAndCheck(() => "../escaped.ts");
  });

  it("a relative path written with windows separators", async () => {
    await emitAndCheck(() => "..\\escaped.ts");
  });

  it("an absolute path", async () => {
    await emitAndCheck((project) => path.join(project.base, "absolute-escaped.ts"));
  });

  it("a relative path that walks up and back down", async () => {
    await emitAndCheck(() => "../inner/../escaped.ts");
  });
});
