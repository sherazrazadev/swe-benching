import { describe, expect, it } from "vitest";
import {
  SAFE_NAME,
  chartFormatter,
  makeHass,
  mountTooltip,
  processChart,
  expectText,
} from "../support/harness";

describe("functional/bluetooth-graph", () => {
  it("the Bluetooth network tooltip keeps its bold labels and values", async () => {
    const { BluetoothNetworkVisualization } = await import(
      "../../src/panels/config/integrations/integration-panels/bluetooth/bluetooth-network-visualization"
    );
    const panel: any = new BluetoothNetworkVisualization();
    panel.hass = makeHass();
    panel._data = [];
    panel._scanners = {};
    panel._sourceDevices = {
      "AA:BB": { id: "dev-a", name_by_user: SAFE_NAME },
      "CC:DD": { id: "dev-b", name_by_user: "Hall Sensor" },
    };
    const processed = processChart(
      { tooltip: { trigger: "item", formatter: panel._tooltipFormatter } },
      []
    );
    const formatter = chartFormatter(processed.options);
    const host = mountTooltip(
      formatter(
        { dataType: "edge", data: { source: "AA:BB", target: "CC:DD", value: -40 } },
        "tooltip-ticket"
      )
    );
    expectText(host, SAFE_NAME, "Bluetooth tooltip");
    expectText(host, "→", "Bluetooth tooltip");
    expectText(host, "rssi", "Bluetooth tooltip");
    expect(host.querySelectorAll("b").length).toBeGreaterThan(0);
  });
});
