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

function expectAllowed(decision) {
  expect(decision.allowed, JSON.stringify(decision)).toBe(true);
}

const REMOTE = "router.example.com";
const LOCAL = "localhost:20128";
const LOGIN = { requireLogin: true, tunnelDashboardAccess: false, tunnelUrl: null, tailscaleUrl: null };
const NO_LOGIN = { requireLogin: false, tunnelDashboardAccess: false, tunnelUrl: null, tailscaleUrl: null };
const CLI = { "x-9r-cli-token": "machine-cli-token" };

beforeEach(() => {
  stubs.getSettings.mockResolvedValue(LOGIN);
  stubs.validateApiKey.mockResolvedValue(false);
  mocks.machineId.mockResolvedValue("machine-cli-token");
  mocks.verify.mockImplementation(async (token) => token === "dashboard-session");
});

describe("local command-line use keeps working", () => {
  it("allows the MCP bridge with the local token", async () => {
    expectAllowed(await decide("/api/mcp/filesystem/message", {
      method: "POST", headers: { host: LOCAL, ...CLI },
    }));
  });

  it("allows the host installer with the local token", async () => {
    expectAllowed(await decide("/api/tunnel/tailscale-install", {
      method: "POST", headers: { host: LOCAL, ...CLI },
    }));
  });

  it("allows local tool configuration with the local token", async () => {
    expectAllowed(await decide("/api/cli-tools/cowork-settings", {
      method: "POST", headers: { host: LOCAL, ...CLI },
    }));
  });
});

describe("public pre-login operations keep working", () => {
  it("allows the login-required read without a session", async () => {
    expectAllowed(await decide("/api/settings/require-login", {
      method: "GET", headers: { host: REMOTE },
    }));
  });

  it("allows the login status read without a session", async () => {
    expectAllowed(await decide("/api/auth/status", {
      method: "GET", headers: { host: REMOTE },
    }));
  });

  it("allows the login endpoint without a session", async () => {
    expectAllowed(await decide("/api/auth/login", {
      method: "POST", headers: { host: REMOTE },
    }));
  });

  it("allows the local model API without a key from the machine itself", async () => {
    expectAllowed(await decide("/v1/chat/completions", {
      method: "POST", headers: { host: LOCAL },
    }));
  });
});

describe("authenticated data operations keep working", () => {
  it("allows a logged-in remote model listing", async () => {
    expectAllowed(await decide("/api/models", {
      method: "GET", headers: { host: REMOTE }, session: true,
    }));
  });

  it("allows ordinary data operations when dashboard login is disabled", async () => {
    stubs.getSettings.mockResolvedValue(NO_LOGIN);
    expectAllowed(await decide("/api/models", {
      method: "GET", headers: { host: REMOTE },
    }));
  });

  it("allows a logged-in remote read of the tunnel service status", async () => {
    expectAllowed(await decide("/api/tunnel/status", {
      method: "GET", headers: { host: REMOTE }, session: true,
    }));
  });
});
