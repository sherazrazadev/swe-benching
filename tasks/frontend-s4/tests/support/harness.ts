/*
 * Verifier support: drives the product's own chart components and the shared chart element,
 * then renders a tooltip the way the charting library does (a string becomes markup, a node is
 * appended) and inspects the resulting document. Nothing here is product code and no expected
 * value is computed from the product.
 */
import { HaChartBase } from "../../src/components/chart/ha-chart-base";

/** An inert payload: as markup it creates an element; as text it stays literal. */
export const MARKUP = '<img src="x" data-pwn="1">';
/** A legitimate display name used next to the payload. */
export const SAFE_NAME = "Kitchen Sensor";

export function installMatchMedia(): void {
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

export function makeHass(extra: Record<string, any> = {}): any {
  installMatchMedia();
  return {
    language: "en",
    locale: {
      language: "en",
      number_format: "language",
      time_format: "language",
      date_format: "language",
      first_weekday: 1,
      time_zone: "UTC",
    },
    config: { time_zone: "UTC", unit_system: {} },
    translationMetadata: { translations: {} },
    localize: (key: string) => key,
    states: {},
    entities: {},
    devices: {},
    areas: {},
    formatEntityState: (_state: any, value?: any) => `${value ?? ""}`,
    ...extra,
  };
}

export interface ChartResult {
  options: any;
  series: any[];
}

/**
 * Feed options and series through a real <ha-chart-base> update the way a chart does, and
 * return the option object the charting library would actually receive.
 */
export function processChart(options: any, data: any[] = []): ChartResult {
  installMatchMedia();
  const base: any = new HaChartBase();
  base._themes = { themes: { darkMode: false } };
  base._hiddenDatasets = new Set();
  base.data = data;
  base.options = options;
  let captured: any;
  base.chart = {
    setOption: (next: any) => {
      captured = next;
    },
    getZr: () => ({ on() {}, animation: { isFinished: () => true } }),
    on() {},
    dispatchAction() {},
    resize() {},
    dispose() {},
    getOption: () => ({}),
  };
  const changed = new Map<any, any>();
  changed.set("options", undefined);
  changed.set("data", undefined);
  base.willUpdate(changed);
  if (!captured) {
    throw new Error("the chart did not produce any options");
  }
  return { options: captured, series: captured.series ?? [] };
}

/** Render a tooltip the way the charting library renders it. */
export function mountTooltip(result: any): HTMLElement {
  const host = document.createElement("div");
  if (typeof result === "string") {
    host.innerHTML = result;
  } else if (result instanceof Node) {
    host.appendChild(result);
  }
  return host;
}

export function tooltipEntries(options: any): any[] {
  const tooltip = options?.tooltip;
  if (!tooltip) {
    return [];
  }
  return Array.isArray(tooltip) ? tooltip : [tooltip];
}

/** The formatter the charting library would use for a whole chart. */
export function chartFormatter(options: any): any {
  for (const entry of tooltipEntries(options)) {
    if (entry && typeof entry.formatter === "function") {
      return entry.formatter;
    }
  }
  return undefined;
}

/** The formatter the charting library would use for one series item. */
export function itemFormatter(series: any[], seriesIndex: number): any {
  const seriesTooltip = series?.[seriesIndex]?.tooltip;
  if (seriesTooltip && typeof seriesTooltip.formatter === "function") {
    return seriesTooltip.formatter;
  }
  return undefined;
}

/** The formatter the charting library would use for one data item of a series. */
export function dataItemFormatter(series: any[], seriesIndex: number, itemIndex: number): any {
  const item = series?.[seriesIndex]?.data?.[itemIndex];
  const formatter = item?.tooltip?.formatter;
  return typeof formatter === "function" ? formatter : undefined;
}

export function expectNoMarkup(host: HTMLElement, where: string): void {
  const injected = host.querySelector("img,svg,script,iframe,object,embed");
  if (injected) {
    throw new Error(`${where}: tooltip parsed supplied data as markup (${injected.tagName})`);
  }
}

export function expectText(host: HTMLElement, text: string, where: string): void {
  if (!host.textContent || !host.textContent.includes(text)) {
    throw new Error(`${where}: expected tooltip text ${JSON.stringify(text)}, got ${JSON.stringify(host.textContent)}`);
  }
}
