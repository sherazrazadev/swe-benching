import { describe, expect, it } from "vitest";
import {
  MARKUP,
  SAFE_NAME,
  chartFormatter,
  mountTooltip,
  processChart,
  expectNoMarkup,
  expectText,
} from "../support/harness";

describe("security/chart-tooltip-list", () => {
  it("a tooltip configured as one of several entries stays safe", () => {
    const formatter = (params: any) =>
      `<b>${params.seriesName}</b>: ${params.name}`;
    const processed = processChart(
      { tooltip: [{ trigger: "item", formatter }] },
      [{ type: "line", name: SAFE_NAME, data: [[1, 1]] }]
    );
    const effective = chartFormatter(processed.options);
    expect(typeof effective).toBe("function");
    const host = mountTooltip(
      effective({ seriesName: SAFE_NAME, name: MARKUP }, "tooltip-ticket")
    );
    expectNoMarkup(host, "chart tooltip list");
    expectText(host, SAFE_NAME, "chart tooltip list");
  });
});
