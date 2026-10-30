import { describe, expect, it } from "vitest";
import {
  SAFE_NAME,
  chartFormatter,
  makeHass,
  mountTooltip,
  processChart,
  expectText,
} from "../support/harness";

describe("functional/zha-graph", () => {
  it("the Zigbee network tooltip keeps its bold labels and link quality", async () => {
    const { ZHANetworkVisualizationPage } = await import(
      "../../src/panels/config/integrations/integration-panels/zha/zha-network-visualization-page"
    );
    const panel: any = new ZHANetworkVisualizationPage();
    panel.hass = makeHass();
    panel._networkData = {
      nodes: [
        { id: "0x01", name: SAFE_NAME },
        { id: "0x02", name: "Hall Sensor" },
      ],
      links: [],
    };
    const processed = processChart(
      { tooltip: { trigger: "item", formatter: panel._tooltipFormatter } },
      []
    );
    const formatter = chartFormatter(processed.options);
    const host = mountTooltip(
      formatter(
        { dataType: "edge", data: { source: "0x01", target: "0x02", value: 42 } },
        "tooltip-ticket"
      )
    );
    expectText(host, SAFE_NAME, "Zigbee tooltip");
    expectText(host, "Hall Sensor", "Zigbee tooltip");
    expectText(host, "LQI", "Zigbee tooltip");
    expect(host.querySelectorAll("b").length).toBeGreaterThan(0);
  });
});
