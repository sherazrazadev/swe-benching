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

describe("security/statistics-graph", () => {
  it("a statistic label is shown as text in the graph tooltip", async () => {
    const { StatisticsChart } = await import(
      "../../src/components/chart/statistics-chart"
    );
    const hass = makeHass({
      states: {
        "sensor.power": {
          entity_id: "sensor.power",
          state: "5",
          attributes: { friendly_name: MARKUP, unit_of_measurement: "kWh" },
          last_changed: "2026-01-01T00:00:00Z",
          last_updated: "2026-01-01T00:00:00Z",
        },
      },
      entities: { "sensor.power": { display_precision: 2 } },
    });
    const chart: any = new StatisticsChart();
    chart.hass = hass;
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
    expect(typeof formatter).toBe("function");
    const seriesName = processed.series[0].name;
    const host = mountTooltip(
      formatter(
        [
          {
            seriesIndex: 0,
            seriesName,
            value: [1500, 5],
            marker: "",
            color: "#ff0000",
          },
        ],
        "tooltip-ticket"
      )
    );
    expectNoMarkup(host, "statistics graph tooltip");
    expectText(host, "5.00", "statistics graph tooltip");
  });
});
