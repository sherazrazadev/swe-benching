import { describe, expect, it } from "vitest";
import {
  SAFE_NAME,
  chartFormatter,
  dataItemFormatter,
  makeHass,
  mountTooltip,
  processChart,
  expectText,
} from "../support/harness";

describe("functional/graph-node-tooltip", () => {
  it("a network node keeps its name and context in the tooltip", async () => {
    const { HaNetworkGraph } = await import(
      "../../src/components/chart/ha-network-graph"
    );
    const graph: any = new HaNetworkGraph();
    graph.hass = makeHass();
    graph.data = {
      nodes: [{ id: "n1", name: SAFE_NAME, context: "Hallway" }],
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
    expect(item.name).toBe(SAFE_NAME);
    const host = mountTooltip(
      effective({ data: item, name: item.name, seriesName: item.name }, "t")
    );
    expectText(host, SAFE_NAME, "network node tooltip");
    expectText(host, "Hallway", "network node tooltip");
  });
});
