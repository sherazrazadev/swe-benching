import { describe, it, expect, vi, beforeEach } from "vitest";

const stubs = vi.hoisted(() => {
  const names = [
    "getSettings", "updateSettings", "isCloudEnabled", "getCloudUrl", "exportSettings",
    "getApiKeys", "getApiKeyById", "createApiKey", "updateApiKey", "deleteApiKey",
    "validateApiKey", "exportDb", "importDb", "initDb",
  ];
  const out = {};
  for (const name of names) out[name] = vi.fn(async () => null);
  out.getSettings = vi.fn();
  out.validateApiKey = vi.fn();
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

function request(pathname, headers) {
  return {
    method: "POST",
    nextUrl: { pathname },
    headers: new Headers(headers),
    cookies: {
      get: (name) => (name === "auth_token" ? { value: "dashboard-session" } : undefined),
    },
    url: `http://localhost:20128${pathname}`,
  };
}

async function decide(pathname, headers) {
  if (!middlewareRuns(pathname)) return { allowed: true, source: "matcher-skipped" };
  const response = await proxy(request(pathname, headers));
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

beforeEach(() => {
  stubs.getSettings.mockResolvedValue({
    requireLogin: true, tunnelDashboardAccess: false, tunnelUrl: null, tailscaleUrl: null,
  });
  stubs.validateApiKey.mockResolvedValue(false);
  // The machine secret cannot be derived on this host.
  mocks.machineId.mockResolvedValue(null);
  mocks.verify.mockImplementation(async (token) => token === "dashboard-session");
});

describe("host operations fail closed when the machine secret is unavailable", () => {
  it("refuses a spoofed-local host installer request when no machine secret can be derived", async () => {
    const decision = await decide("/api/tunnel/tailscale-install", {
      host: "localhost:20128",
      "x-9r-cli-token": "any-supplied-token",
    });
    expect(decision.allowed, JSON.stringify(decision)).toBe(false);
      expect(decision.status).toBeGreaterThanOrEqual(400);
    expect(decision.status).toBeLessThan(500);
    });
});
