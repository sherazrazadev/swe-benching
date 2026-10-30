import { describe, expect, it } from "vitest";
import {
  SAFE_NAME,
  chartFormatter,
  makeHass,
  mountTooltip,
  processChart,
  expectText,
} from "../support/harness";

describe("functional/statistics-graph", () => {
  it("a legitimate statistic label, value and unit still render, once per series", async () => {
    const { StatisticsChart } = await import(
      "../../src/components/chart/statistics-chart"
    );
    const chart: any = new StatisticsChart();
    chart.hass = makeHass({
      states: {
        "sensor.power": {
          entity_id: "sensor.power",
          state: "5",
          attributes: { friendly_name: SAFE_NAME, unit_of_measurement: "kWh" },
          last_changed: "2026-01-01T00:00:00Z",
          last_updated: "2026-01-01T00:00:00Z",
        },
      },
      entities: { "sensor.power": { display_precision: 2 } },
    });
    chart.statisticsData = {
      "sensor.power": [{ start: 1000, end: 2000, mean: 5 }],
    };
    chart.metadata = {
      "sensor.power": {
        statistic_id: "sensor.power",
        source: "recorder",
        has_sum: false,
        mean_type: 0,
        unit_class: null,
        statistics_unit_of_measurement: "kWh",
      },
    };
    chart.colors = { "sensor.power": "#ff0000" };
    chart.startTime = new Date(1000);
    chart.endTime = new Date(2000);
    await chart._generateData();
    chart._createOptions();
    const processed = processChart(chart._chartOptions, chart._chartData);
    const formatter = chartFormatter(processed.options);
    const seriesName = processed.series[0].name;
    const host = mountTooltip(
      formatter(
        [
          { seriesIndex: 0, seriesName, value: [1500, 5], marker: "", color: "#ff0000" },
          { seriesIndex: 0, seriesName, value: [1500, 5], marker: "", color: "#ff0000" },
        ],
        "tooltip-ticket"
      )
    );
    expectText(host, SAFE_NAME, "statistics graph tooltip");
    expectText(host, "5.00", "statistics graph tooltip");
    expectText(host, "kWh", "statistics graph tooltip");
    expect(host.querySelectorAll("br").length).toBeGreaterThan(0);
    const occurrences = host.textContent!.split(SAFE_NAME).length - 1;
    expect(occurrences).toBe(1);
  });
});
