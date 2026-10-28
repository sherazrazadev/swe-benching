/**
 * @jest-environment jsdom
 */
import renderMathInElement from "katex/contrib/auto-render";
import {
    ATTACK_URL, carriesUrlAsAttribute, cleanPrototype, PLANTED_EXPANSION,
} from "../support/proto";

afterEach(cleanPrototype);

function renderSource(source: string): HTMLElement {
    const element = document.createElement("div");
    element.textContent = source;
    const previous = console.error;
    (console as unknown as {error: (...a: unknown[]) => void}).error =
        () => undefined;
    try {
        renderMathInElement(element);
    } finally {
        (console as unknown as {error: (...a: unknown[]) => void}).error = previous;
    }
    return element;
}

describe("auto-render takes its render options from the caller's own entries", () => {
    it("does not take a macro table inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).macros = {"\\pwn": PLANTED_EXPANSION};
        const element = renderSource("$$\\pwn$$");
        expect(element.innerHTML).not.toContain("PWNED");
    });

    it("does not take delimiters inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).delimiters = [
            {left: "[[", right: "]]", display: false},
        ];
        const element = renderSource("[[x]]");
        expect(element.querySelector(".katex")).toBeNull();
    });

    it("does not forward a trust setting inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).trust = true;
        const element = renderSource(`$$\\href{${ATTACK_URL}}{x}$$`);
        expect(carriesUrlAsAttribute(element.innerHTML, ATTACK_URL)).toBe(false);
    });

    it("does not forward an inherited trust setting to a bare URL command", () => {
        (Object.prototype as Record<string, unknown>).trust = true;
        const element = renderSource(`$$\\url{${ATTACK_URL}}$$`);
        expect(carriesUrlAsAttribute(element.innerHTML, ATTACK_URL)).toBe(false);
    });
});
