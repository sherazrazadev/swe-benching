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

describe("security/bluetooth-graph", () => {
  it("a Bluetooth device name is shown as text in the network tooltip", async () => {
    const { BluetoothNetworkVisualization } = await import(
      "../../src/panels/config/integrations/integration-panels/bluetooth/bluetooth-network-visualization"
    );
    const panel: any = new BluetoothNetworkVisualization();
    panel.hass = makeHass();
    panel._data = [];
    panel._scanners = {};
    panel._sourceDevices = {
      "AA:BB": { id: "dev-a", name_by_user: MARKUP },
      "CC:DD": { id: "dev-b", name_by_user: SAFE_NAME },
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
          data: { source: "AA:BB", target: "CC:DD", value: -40 },
        },
        "tooltip-ticket"
      )
    );
    expectNoMarkup(host, "Bluetooth network tooltip");
    expectText(host, SAFE_NAME, "Bluetooth network tooltip");
  });
});
