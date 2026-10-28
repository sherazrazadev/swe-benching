/**
 * @jest-environment jsdom
 */
import renderMathInElement from "katex/contrib/auto-render";
import {cleanPrototype, PLANTED_EXPANSION} from "../support/proto";

afterEach(cleanPrototype);

describe("auto-render takes its render options from the caller's own entries", () => {
    it("does not take a macro table inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).macros = {"\\pwn": PLANTED_EXPANSION};
        const element = document.createElement("div");
        element.textContent = "$$\\pwn$$";
        const errors: unknown[] = [];
        const previous = console.error;
        (console as unknown as {error: (...a: unknown[]) => void}).error =
            (...args: unknown[]) => { errors.push(args); };
        try {
            renderMathInElement(element);
        } finally {
            (console as unknown as {error: (...a: unknown[]) => void}).error = previous;
        }
        expect(element.innerHTML).not.toContain("PWNED");
    });

    it("does not take delimiters inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).delimiters = [
            {left: "[[", right: "]]", display: false},
        ];
        const element = document.createElement("div");
        element.textContent = "[[x]]";
        renderMathInElement(element);
        expect(element.querySelector(".katex")).toBeNull();
    });
});
