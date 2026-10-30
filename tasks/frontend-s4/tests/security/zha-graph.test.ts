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

describe("security/zha-graph", () => {
  it("a Zigbee node name is shown as text in the network tooltip", async () => {
    const { ZHANetworkVisualizationPage } = await import(
      "../../src/panels/config/integrations/integration-panels/zha/zha-network-visualization-page"
    );
    const panel: any = new ZHANetworkVisualizationPage();
    panel.hass = makeHass();
    panel._networkData = {
      nodes: [
        { id: "0x01", name: MARKUP },
        { id: "0x02", name: SAFE_NAME },
      ],
      links: [],
    };
    const processed = processChart(
      { tooltip: { trigger: "item", formatter: panel._tooltipFormatter } },
      []
    );
    const formatter = chartFormatter(processed.options);
    expect(typeof formatter).toBe("function");
    const host = mountTooltip(
      formatter(
        {
          dataType: "edge",
          data: { source: "0x01", target: "0x02", value: 42 },
        },
        "tooltip-ticket"
      )
    );
    expectNoMarkup(host, "Zigbee network tooltip");
    expectText(host, SAFE_NAME, "Zigbee network tooltip");
  });
});
