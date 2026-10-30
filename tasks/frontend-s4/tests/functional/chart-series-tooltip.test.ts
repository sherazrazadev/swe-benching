import { describe, expect, it } from "vitest";
import {
  SAFE_NAME,
  itemFormatter,
  mountTooltip,
  processChart,
  expectText,
} from "../support/harness";

describe("functional/chart-series-tooltip", () => {
  it("a tooltip configured on a series still renders its content", () => {
    const processed = processChart({}, [
      {
        type: "line",
        name: SAFE_NAME,
        data: [[1, 1]],
        tooltip: {
          trigger: "item",
          formatter: (params: any) => `series ${params.seriesName}`,
        },
      },
    ]);
    const formatter = itemFormatter(processed.series, 0);
    expect(typeof formatter).toBe("function");
    const host = mountTooltip(formatter({ seriesName: SAFE_NAME }, "t"));
    expectText(host, SAFE_NAME, "series tooltip");
  });
});
