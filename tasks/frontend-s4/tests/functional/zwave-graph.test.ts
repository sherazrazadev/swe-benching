import { describe, expect, it } from "vitest";
import {
  SAFE_NAME,
  chartFormatter,
  makeHass,
  mountTooltip,
  processChart,
  expectText,
} from "../support/harness";

describe("functional/zwave-graph", () => {
  it("the Z-Wave network tooltip keeps its bold labels and signal value", async () => {
    const { ZWaveJSNetworkVisualization } = await import(
      "../../src/panels/config/integrations/integration-panels/zwave_js/zwave_js-network-visualization"
    );
    const panel: any = new ZWaveJSNetworkVisualization();
    panel.hass = makeHass();
    panel._nodeStatistics = {};
    panel._nodeStatuses = {};
    panel._devices = {
      1: { id: "d1", name_by_user: SAFE_NAME },
      2: { id: "d2", name_by_user: "Hall Sensor" },
    };
    const processed = processChart(
      { tooltip: { trigger: "item", formatter: panel._tooltipFormatter } },
      []
    );
    const formatter = chartFormatter(processed.options);
    const host = mountTooltip(
      formatter(
        { dataType: "edge", data: { source: 1, target: 2, value: 7 } },
        "tooltip-ticket"
      )
    );
    expectText(host, SAFE_NAME, "Z-Wave tooltip");
    expectText(host, "Hall Sensor", "Z-Wave tooltip");
    expectText(host, "RSSI", "Z-Wave tooltip");
    expect(host.querySelectorAll("b").length).toBeGreaterThan(0);
  });
});
