/**
 * Shared harness for the hidden suites.
 *
 * Every scenario drives the product through its real MCP entry point: a FastMCP server
 * with the project's own tool registrars, connected to an MCP client over the SDK's
 * in-memory transport. Only the infrastructure boundary is stubbed: the Appium driver
 * object held in the session store answers the device calls with the values a device
 * would return. The HTML the server sends back is rendered in a DOM so the tests can
 * observe what a client would actually parse and run.
 */
import { FastMCP } from 'fastmcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { JSDOM, VirtualConsole } from 'jsdom';

import { setSession } from '../../dist/session-store.js';
import generateLocators from '../../dist/tools/test-generation/locators.js';
import getPageSourceTool from '../../dist/tools/interactions/get-page-source.js';
import getElementAttributeTool from '../../dist/tools/interactions/get-element-attribute.js';

export const ANDROID_CAPS = {
  platformName: 'Android',
  'appium:automationName': 'uiautomator2',
};

/** XML-escape a value so it can be placed inside an attribute of a test page source. */
export function xmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** A page source containing one clickable Android element with the given fields. */
export function androidPageSource({ text = '', contentDesc = '', resourceId = 'com.example:id/widget', tag = 'android.widget.TextView' } = {}) {
  return `<hierarchy>\n  <${tag} text="${xmlAttr(text)}" content-desc="${xmlAttr(contentDesc)}" resource-id="${xmlAttr(resourceId)}" clickable="true" enabled="true" displayed="true"/>\n</hierarchy>`;
}

/** The device boundary: answers the driver calls the tools make. */
export function makeDriver({ pageSource = '', attributes = {}, capabilities = ANDROID_CAPS } = {}) {
  return {
    capabilities,
    getPageSource: async () => pageSource,
    getElementAttribute: async (_elementId, attribute) =>
      Object.prototype.hasOwnProperty.call(attributes, attribute) ? attributes[attribute] : null,
  };
}

/** Register the product tools on a real FastMCP server and connect a real MCP client. */
export async function openServer({ driver, sessionId = 'test-session-1' }) {
  await setSession(driver, sessionId, driver.capabilities);
  const server = new FastMCP({ name: 'appium-mcp-hidden-suite', version: '1.0.0' });
  generateLocators(server);
  getPageSourceTool(server);
  getElementAttributeTool(server);

  const client = new Client({ name: 'appium-mcp-hidden-suite-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    sessionId,
    call(name, args = {}) {
      return client.callTool({ name, arguments: { ...args, sessionId } });
    },
    close() {
      return client.close();
    },
  };
}

/** The HTML views (MCP-UI resources) carried by a tool result. */
export function htmlViews(result) {
  return (result?.content ?? [])
    .filter((item) => item.type === 'resource' && item.resource?.mimeType === 'text/html')
    .map((item) => item.resource.text);
}

/** Render a view the way a client would: parse it and run its scripts. */
export function renderView(html) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', () => {
    // A view that fails to parse its own scripts is an observation of the page, not a
    // harness error; the tests assert on the resulting window and document instead.
  });
  return new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://mcp-ui.hidden.test/',
    virtualConsole,
  });
}

/** Fire the interactions a reader could produce against a rendered view. */
export function interact(dom) {
  const { window } = dom;
  const document = window.document;
  for (const element of Array.from(document.querySelectorAll('*'))) {
    for (const type of ['mouseover', 'focus']) {
      try {
        element.dispatchEvent(new window.MouseEvent(type, { bubbles: true }));
      } catch {
        /* the view may not accept this event */
      }
    }
    try {
      element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    } catch {
      /* the view may not accept this event */
    }
  }
  for (const field of Array.from(document.querySelectorAll('input, textarea'))) {
    try {
      field.dispatchEvent(new window.Event('input', { bubbles: true }));
    } catch {
      /* the view may not accept this event */
    }
  }
}

/** Render and interact with every returned view, returning the DOMs. */
export function renderAll(result) {
  return htmlViews(result).map((html) => {
    const dom = renderView(html);
    interact(dom);
    return dom;
  });
}
