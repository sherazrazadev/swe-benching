import { describe, expect, it } from "vitest";
import {
  MARKUP,
  SAFE_NAME,
  chartFormatter,
  dataItemFormatter,
  makeHass,
  mountTooltip,
  processChart,
  expectNoMarkup,
  expectText,
} from "../support/harness";

describe("security/graph-node-tooltip", () => {
  it("a network node name is shown as text in its own tooltip", async () => {
    const { HaNetworkGraph } = await import(
      "../../src/components/chart/ha-network-graph"
    );
    const graph: any = new HaNetworkGraph();
    graph.hass = makeHass();
    graph.data = {
      nodes: [{ id: "n1", name: MARKUP, context: SAFE_NAME }],
      links: [],
    };
    graph.tooltipFormatter = (params: any) => `${params.data?.name ?? ""}`;
    const options = graph._createOptions(undefined);
    const series = graph._getSeries(graph.data, false, false, true, false, undefined);
    const processed = processChart(options, series);
    const effective =
      dataItemFormatter(processed.series, 0, 0) ??
      chartFormatter(processed.options);
    expect(typeof effective).toBe("function");
    const item = processed.series[0].data[0];
    const host = mountTooltip(
      effective({ data: item, name: item.name, seriesName: item.name }, "tooltip-ticket")
    );
    expectNoMarkup(host, "network node tooltip");
    expectText(host, SAFE_NAME, "network node tooltip");
  });
});
