// Shared helpers for the hidden Markdown-rendering suites.
// Everything here is computed in the test process; no product helper is used to decide
// what counts as safe.
import {expect} from "vitest";

export const DOCS_OPTIONS = {
    permalink: false,
    html: true,
    variant: "enhanced" as const,
    showCopyButtons: true,
    linkify: true,
};

export const LOG_OPTIONS = {onlyLink: true, html: true};
export const TOAST_OPTIONS = {html: true};

export interface RouteCall {
    name?: string;
    params?: Record<string, unknown>;
}

/** A router double that records what the product resolves and returns a stable href. */
export function recordingRouter(): any {
    const calls: RouteCall[] = [];
    return {
        calls,
        resolve(route: RouteCall) {
            calls.push({name: route.name, params: {...(route.params ?? {})}});
            const params = route.params ?? {};
            return {href: `/ui/${route.name}/${Object.values(params).join("/")}`};
        },
        push() {
            /* navigation is not part of the rendered output */
        },
    };
}

/** Parse rendered HTML the way the browser would, without running any script. */
export function toDom(html: string): HTMLElement {
    const root = document.createElement("div");
    root.innerHTML = html;
    return root;
}

const EMBEDDED = new Set(["script", "iframe", "object", "embed"]);
const URL_ATTRS = new Set(["href", "src", "xlink:href", "formaction", "action", "srcdoc", "data"]);

/**
 * Active markup is anything in the parsed DOM that a browser would treat as code rather
 * than content: event-handler attributes, embedded objects, a script-bearing URL, or the
 * overlay style used by the report. Benign attributes and elements are not errors.
 */
export function activeMarkup(root: ParentNode): string[] {
    const found: string[] = [];
    root.querySelectorAll("*").forEach((element) => {
        const tag = element.tagName.toLowerCase();
        if (EMBEDDED.has(tag)) {
            found.push(`element:${tag}`);
        }
        for (const attr of Array.from(element.attributes)) {
            const name = attr.name.toLowerCase();
            const value = attr.value.trim();
            if (name.startsWith("on")) {
                found.push(`${tag}@${name}`);
            } else if (name === "style" && /position\s*:\s*fixed/i.test(value)) {
                found.push(`${tag}@style`);
            } else if (URL_ATTRS.has(name) && /^(javascript|vbscript|data:text\/html)/i.test(value)) {
                found.push(`${tag}@${name}`);
            }
        }
    });
    return found;
}

export function expectInert(root: ParentNode): void {
    expect(activeMarkup(root)).toEqual([]);
}

/** Deterministic attribute map for one element, used to check intended output. */
export function attributesOf(element: Element | null): Record<string, string> {
    if (!element) return {};
    const out: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
        out[attr.name.toLowerCase()] = attr.value;
    }
    return out;
}
