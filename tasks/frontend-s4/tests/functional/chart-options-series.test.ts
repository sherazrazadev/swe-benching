import { describe, expect, it } from "vitest";
import {
  SAFE_NAME,
  itemFormatter,
  mountTooltip,
  processChart,
  expectText,
} from "../support/harness";

describe("functional/chart-options-series", () => {
  it("a series supplied with the chart options still reaches the chart", () => {
    const processed = processChart(
      {
        series: [
          {
            type: "line",
            name: SAFE_NAME,
            data: [[1, 1]],
            tooltip: {
              trigger: "item",
              formatter: (params: any) => `options ${params.seriesName}`,
            },
          },
        ],
      },
      []
    );
    expect(processed.series.length).toBe(1);
    expect(processed.series[0].name).toBe(SAFE_NAME);
    expect(processed.series[0].data).toEqual([[1, 1]]);
    const formatter = itemFormatter(processed.series, 0);
    expect(typeof formatter).toBe("function");
    const host = mountTooltip(formatter({ seriesName: SAFE_NAME }, "t"));
    expectText(host, SAFE_NAME, "options series tooltip");
  });
});
