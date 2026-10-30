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

describe("security/zwave-graph", () => {
  it("a Z-Wave device name is shown as text in the network tooltip", async () => {
    const { ZWaveJSNetworkVisualization } = await import(
      "../../src/panels/config/integrations/integration-panels/zwave_js/zwave_js-network-visualization"
    );
    const panel: any = new ZWaveJSNetworkVisualization();
    panel.hass = makeHass();
    panel._nodeStatistics = {};
    panel._nodeStatuses = {};
    panel._devices = {
      1: { id: "d1", name_by_user: MARKUP },
      2: { id: "d2", name_by_user: SAFE_NAME },
    };
    const processed = processChart(
      { tooltip: { trigger: "item", formatter: panel._tooltipFormatter } },
      []
    );
    const formatter = chartFormatter(processed.options);
    expect(typeof formatter).toBe("function");
    const host = mountTooltip(
      formatter(
        { dataType: "edge", data: { source: 1, target: 2, value: 7 } },
        "tooltip-ticket"
      )
    );
    expectNoMarkup(host, "Z-Wave network tooltip");
    expectText(host, SAFE_NAME, "Z-Wave network tooltip");
  });
});
