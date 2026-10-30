import { describe, expect, it } from "vitest";
import {
  SAFE_NAME,
  tooltipEntries,
  mountTooltip,
  processChart,
  expectText,
} from "../support/harness";

describe("functional/chart-tooltip-list", () => {
  it("a chart may supply several tooltip entries and each keeps working", () => {
    const processed = processChart(
      {
        tooltip: [
          { trigger: "item", formatter: (params: any) => `first ${params.seriesName}` },
          { trigger: "axis", formatter: (params: any) => `second ${params.seriesName}` },
        ],
      },
      [{ type: "line", name: SAFE_NAME, data: [[1, 1]] }]
    );
    const entries = tooltipEntries(processed.options);
    expect(entries.length).toBe(2);
    expect(typeof entries[0].formatter).toBe("function");
    expect(typeof entries[1].formatter).toBe("function");
    const first = mountTooltip(entries[0].formatter({ seriesName: SAFE_NAME }, "t"));
    const second = mountTooltip(entries[1].formatter({ seriesName: SAFE_NAME }, "t"));
    expectText(first, SAFE_NAME, "first tooltip entry");
    expectText(second, SAFE_NAME, "second tooltip entry");
  });
});
