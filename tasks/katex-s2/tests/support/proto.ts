/* Shared cleanup and assertions for the prototype-pollution security cases.
 * Every case plants one entry on the shared object prototype and removes it
 * afterwards, so no case can influence another one in the same worker.
 */
export const POLLUTED_KEYS = [
    "trust",
    "default",
    "processor",
    "protocol",
    "url",
    "macros",
    "delimiters",
    "ignoredTags",
    "ignoredClasses",
    "errorCallback",
    "class",
    "id",
    "style",
    "title",
    "data",
    "\\pwn",
    "\\href",
];

export function cleanPrototype(): void {
    for (const key of POLLUTED_KEYS) {
        delete (Object.prototype as Record<string, unknown>)[key];
    }
}

export const ATTACK_URL = "javascript:alert(1)";

/** Macro expansion that renders as one contiguous word, so a marker check can see it. */
export const PLANTED_EXPANSION = "\\text{PWNED}";

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the markup carries `url` as the value of an href/src attribute. */
export function carriesUrlAsAttribute(markup: string, url: string): boolean {
    return new RegExp('(?:href|src)\\s*=\\s*"' + escapeRegExp(url) + '"', "i")
        .test(markup);
}

/** True when the markup carries `value` as a whitespace-separated item of `name`. */
export function carriesAttributeItem(
    markup: string, name: string, value: string,
): boolean {
    const re = new RegExp('\\b' + escapeRegExp(name) + '="([^"]*)"', "ig");
    let m: RegExpExecArray | null;
    while ((m = re.exec(markup)) !== null) {
        if (m[1].trim().split(/\s+/).includes(value)) {
            return true;
        }
    }
    return false;
}

/** True when `name` appears as an attribute name in the markup. */
export function carriesAttribute(markup: string, name: string): boolean {
    return new RegExp('\\b' + escapeRegExp(name) + '="', "i").test(markup);
}
