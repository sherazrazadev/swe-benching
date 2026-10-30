import { describe, expect, it } from "vitest";
import {
  MARKUP,
  SAFE_NAME,
  chartFormatter,
  makeHass,
  mountTooltip,
  processChart,
  expectNoMarkup,
  expectText,
} from "../support/harness";

describe("security/history-timeline", () => {
  it("a state name is shown as text in the history timeline tooltip", async () => {
    const { StateHistoryChartTimeline } = await import(
      "../../src/components/chart/state-history-chart-timeline"
    );
    const chart: any = new StateHistoryChartTimeline();
    chart.hass = makeHass();
    chart.data = [];
    chart.startTime = new Date(0);
    chart.endTime = new Date(1000);
    chart._chartData = [
      { id: "sensor.door", name: SAFE_NAME, type: "custom", data: [] },
    ];
    chart._createOptions();
    const processed = processChart(chart._chartOptions, chart._chartData);
    const formatter = chartFormatter(processed.options);
    expect(typeof formatter).toBe("function");
    const host = mountTooltip(
      formatter(
        {
          value: ["sensor.door", new Date(0), new Date(1000), MARKUP, "#ff0000", "#fff"],
          name: MARKUP,
          seriesName: SAFE_NAME,
          color: "#ff0000",
          marker: "",
        },
        "tooltip-ticket"
      )
    );
    expectNoMarkup(host, "history timeline tooltip");
    expectText(host, SAFE_NAME, "history timeline tooltip");
  });
});
