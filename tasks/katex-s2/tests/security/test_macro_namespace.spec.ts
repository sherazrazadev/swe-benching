import katex from "katex";
import {cleanPrototype, PLANTED_EXPANSION} from "../support/proto";

afterEach(cleanPrototype);

describe("a macro name is a definition only when the renderer or the caller made it one", () => {
    it("does not expand a name inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>)["\\pwn"] = PLANTED_EXPANSION;
        let out = "";
        try {
            out = katex.renderToString("\\pwn");
        } catch (e) {
            // an unknown control sequence is a valid refusal
        }
        expect(out).not.toContain("PWNED");
    });

    it("does not let an inherited name replace a built-in command", () => {
        (Object.prototype as Record<string, unknown>)["\\href"] = PLANTED_EXPANSION;
        let out = "";
        try {
            out = katex.renderToString("\\href{https://example.com}{x}", {trust: true});
        } catch (e) {
            // refused
        }
        expect(out).not.toContain("PWNED");
    });

    it("does not expand an inherited name after it was set and restored inside a group", () => {
        (Object.prototype as Record<string, unknown>)["\\pwn"] = PLANTED_EXPANSION;
        let out = "";
        try {
            out = katex.renderToString("{\\def\\pwn{}}\\pwn");
        } catch (e) {
            // refused
        }
        expect(out).not.toContain("PWNED");
    });
});
