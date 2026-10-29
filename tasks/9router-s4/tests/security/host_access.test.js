import { describe, it, expect, vi, beforeEach } from "vitest";

const stubs = vi.hoisted(() => {
  const names = [
    "getSettings", "updateSettings", "isCloudEnabled", "getCloudUrl", "exportSettings",
    "getProviderConnections", "getProviderConnectionById", "createProviderConnection",
    "updateProviderConnection", "deleteProviderConnection", "deleteProviderConnectionsByProvider",
    "reorderProviderConnections", "cleanupProviderConnections",
    "getProviderNodes", "getProviderNodeById", "createProviderNode", "updateProviderNode",
    "deleteProviderNode", "getProxyPools", "getProxyPoolById", "createProxyPool",
    "updateProxyPool", "deleteProxyPool", "getApiKeys", "getApiKeyById", "createApiKey",
    "updateApiKey", "deleteApiKey", "validateApiKey", "getCombos", "getComboById",
    "getComboByName", "createCombo", "updateCombo", "deleteCombo", "getModelAliases",
    "setModelAlias", "deleteModelAlias", "getCustomModels", "addCustomModel",
    "deleteCustomModel", "getMitmAlias", "setMitmAliasAll", "getPricing",
    "getPricingForModel", "updatePricing", "resetPricing", "resetAllPricing", "exportDb",
    "importDb", "getDisabledModels", "getDisabledByProvider", "disableModels", "enableModels",
    "statsEmitter", "trackPendingRequest", "getActiveRequests", "saveRequestUsage",
    "getUsageHistory", "getUsageStats", "getChartData", "appendRequestLog", "getRecentLogs",
    "saveRequestDetail", "getRequestDetails", "getRequestDetailById", "initDb",
  ];
  const out = {};
  for (const name of names) out[name] = vi.fn(async () => null);
  out.getSettings = vi.fn();
  out.validateApiKey = vi.fn();
  out.statsEmitter = { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
  return out;
});

const mocks = vi.hoisted(() => {
  const NEXT = Symbol("next");
  return {
    NEXT,
    json: vi.fn((body, init) => ({ __kind: "json", status: init?.status || 200, body })),
    redirect: vi.fn((url) => ({ __kind: "redirect", status: 307, url })),
    machineId: vi.fn(),
    verify: vi.fn(),
  };
});

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => mocks.NEXT),
    json: mocks.json,
    redirect: mocks.redirect,
  },
}));
vi.mock("@/lib/localDb", () => stubs);
vi.mock("@/lib/db/index.js", () => stubs);
vi.mock("@/lib/db", () => stubs);
vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: mocks.machineId,
  getRawMachineId: vi.fn(async () => null),
  isBrowser: () => false,
}));
vi.mock("@/lib/auth/dashboardSession", () => ({
  verifyDashboardAuthToken: mocks.verify,
  getDashboardAuthSession: vi.fn(async () => null),
  createDashboardAuthToken: vi.fn(async () => ""),
  shouldUseSecureCookie: vi.fn(() => false),
  setDashboardAuthCookie: vi.fn(),
  clearDashboardAuthCookie: vi.fn(),
}));

const mod = await import("../../src/proxy.js");
const proxy = mod.proxy || mod.default;
const config = mod.config;

// Compile the exported matcher exactly the way Next.js does at build time. When the
// middleware exports no matcher, Next runs it for every request.
const { getMiddlewareMatchers } = await import("next/dist/build/analysis/get-page-static-info");
let matchers;
try {
  matchers = !config || config.matcher == null
    ? [{ regexp: ".*" }]
    : getMiddlewareMatchers(config.matcher, {});
} catch {
  matchers = [];
}
function middlewareRuns(pathname) {
  try {
    return matchers.some((m) => new RegExp(m.regexp).exec(pathname));
  } catch {
    return false;
  }
}

function request(pathname, { method = "GET", headers = {}, session = false } = {}) {
  return {
    method,
    nextUrl: { pathname },
    headers: new Headers(headers),
    cookies: {
      get: (name) =>
        session && name === "auth_token" ? { value: "dashboard-session" } : undefined,
    },
    url: `http://localhost:20128${pathname}`,
  };
}

async function decide(pathname, options) {
  // Next only invokes the access decision for paths its matcher matches; any other
  // request goes straight to the route.
  if (!middlewareRuns(pathname)) return { allowed: true, source: "matcher-skipped" };
  const response = await proxy(request(pathname, options));
  if (response === mocks.NEXT) return { allowed: true, source: "next" };
  if (response && typeof response.status === "number") {
    return {
      allowed: !(response.status >= 400 && response.status < 500),
      source: "response",
      status: response.status,
    };
  }
  return { allowed: true, source: "other", status: response?.status };
}

function expectRefused(decision) {
  expect(decision.allowed, JSON.stringify(decision)).toBe(false);
  expect(decision.status).toBeGreaterThanOrEqual(400);
  expect(decision.status).toBeLessThan(500);
}

const REMOTE = "router.example.com";
const SPOOFED = "localhost:20128";
const LOGIN = { requireLogin: true, tunnelDashboardAccess: false, tunnelUrl: null, tailscaleUrl: null };

beforeEach(() => {
  stubs.getSettings.mockResolvedValue(LOGIN);
  stubs.validateApiKey.mockResolvedValue(false);
  mocks.machineId.mockResolvedValue("machine-cli-token");
  mocks.verify.mockImplementation(async (token) => token === "dashboard-session");
});

describe("host operations require the machine-local secret", () => {
  it("refuses a spoofed-local request that starts the host installer", async () => {
    expectRefused(await decide("/api/tunnel/tailscale-install", {
      method: "POST", headers: { host: SPOOFED }, session: true,
    }));
  });

  it("refuses a logged-in remote request to the local MCP bridge", async () => {
    expectRefused(await decide("/api/mcp/filesystem/message", {
      method: "POST", headers: { host: SPOOFED }, session: true,
    }));
  });

  it("refuses remote import from the first browser credential store", async () => {
    expectRefused(await decide("/api/oauth/cursor/auto-import", {
      method: "GET", headers: { host: REMOTE }, session: true,
    }));
  });

  it("refuses remote import from the second browser credential store", async () => {
    expectRefused(await decide("/api/oauth/kiro/auto-import", {
      method: "GET", headers: { host: REMOTE }, session: true,
    }));
  });

  it("refuses remote import from the desktop editor credential store", async () => {
    expectRefused(await decide("/api/oauth/windsurf/auto-import", {
      method: "GET", headers: { host: REMOTE }, session: true,
    }));
  });

  it("refuses a remote call that starts the host updater", async () => {
    expectRefused(await decide("/api/version/update", {
      method: "POST", headers: { host: REMOTE }, session: true,
    }));
  });

  it("refuses a logged-in remote shutdown of the host service", async () => {
    expectRefused(await decide("/api/version/shutdown", {
      method: "POST", headers: { host: REMOTE }, session: true,
    }));
  });

  it("refuses a logged-in remote shutdown of the running application", async () => {
    expectRefused(await decide("/api/shutdown", {
      method: "POST", headers: { host: SPOOFED }, session: true,
    }));
  });

  it("refuses remote control of the tailscale service", async () => {
    expectRefused(await decide("/api/tunnel/tailscale-start-daemon", {
      method: "POST", headers: { host: SPOOFED }, session: true,
    }));
  });

  it("refuses remote control of the cloudflared service", async () => {
    expectRefused(await decide("/api/tunnel/enable", {
      method: "POST", headers: { host: SPOOFED }, session: true,
    }));
  });

  it("refuses a remote write of the machine secret into another tool's configuration", async () => {
    expectRefused(await decide("/api/cli-tools/zed-settings", {
      method: "POST", headers: { host: SPOOFED }, session: true,
    }));
  });

  it("refuses remote host diagnostics that run commands and return host logs", async () => {
    expectRefused(await decide("/api/version/repair", {
      method: "POST", headers: { host: REMOTE }, session: true,
    }));
  });
});

describe("every non-public API operation requires an operator credential", () => {
  const unauthenticated = [
    "/api/models",
    "/api/usage/stats",
    "/api/combos",
    "/api/proxy-pools",
    "/api/providers",
  ];
  for (const pathname of unauthenticated) {
    it(`refuses an unauthenticated request for ${pathname}`, async () => {
      expectRefused(await decide(pathname, { method: "GET", headers: { host: REMOTE } }));
    });
  }
});
