import { describe, expect, it } from "vitest";
import {
  MARKUP,
  SAFE_NAME,
  itemFormatter,
  mountTooltip,
  processChart,
  expectNoMarkup,
  expectText,
} from "../support/harness";

describe("security/chart-series-tooltip", () => {
  it("a tooltip configured on a series stays safe", () => {
    const processed = processChart({}, [
      {
        type: "line",
        name: SAFE_NAME,
        data: [[1, 1]],
        tooltip: {
          trigger: "item",
          formatter: (params: any) =>
            `<b>${params.seriesName}</b>: ${params.name}`,
        },
      },
    ]);
    const effective = itemFormatter(processed.series, 0);
    expect(typeof effective).toBe("function");
    const host = mountTooltip(
      effective({ seriesName: SAFE_NAME, name: MARKUP }, "tooltip-ticket")
    );
    expectNoMarkup(host, "chart series tooltip");
    expectText(host, SAFE_NAME, "chart series tooltip");
  });
});
