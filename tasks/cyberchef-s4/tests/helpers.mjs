// Shared bookkeeping for the hidden suites. Nothing here computes an expected value from product
// code: expectations are literal strings written in each test.

export function uniqueToken(prefix = "probe") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// A harmless marker whose presence in raw form means the output was not escaped.
export function payloadFor(token) {
    return `<img src=x onerror=${token}>`;
}

export const ESCAPED_PREFIX = "&lt;img src=x onerror=";

// Reads a value that must be an own entry of the returned map, accepting a plain object or a Map.
export function lookupOwn(data, key) {
    if (data instanceof Map) return data.has(key) ? data.get(key) : undefined;
    if (data === null || typeof data !== "object") return undefined;
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined;
}

export function deleteSharedProperty(key) {
    delete Object.prototype[key];
    delete Object[key];
}
