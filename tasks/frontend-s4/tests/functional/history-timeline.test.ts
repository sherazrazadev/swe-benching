import { describe, expect, it } from "vitest";
import {
  SAFE_NAME,
  chartFormatter,
  makeHass,
  mountTooltip,
  processChart,
  expectText,
} from "../support/harness";

describe("functional/history-timeline", () => {
  it("the timeline tooltip keeps its heading, times and line breaks", async () => {
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
    const host = mountTooltip(
      formatter(
        {
          value: ["sensor.door", new Date(0), new Date(1000), "Open", "#ff0000", "#fff"],
          name: "Open",
          seriesName: SAFE_NAME,
          color: "#ff0000",
          marker: "",
        },
        "tooltip-ticket"
      )
    );
    expect(host.querySelectorAll("h4").length, "heading").toBe(1);
    expectText(host, SAFE_NAME, "timeline tooltip");
    expectText(host, "Open", "timeline tooltip");
    expectText(host, "ui.components.history_charts.duration", "timeline tooltip");
    expect(host.querySelectorAll("br").length).toBeGreaterThanOrEqual(3);
  });
});
