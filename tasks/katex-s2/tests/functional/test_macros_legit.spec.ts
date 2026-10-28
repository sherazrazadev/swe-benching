import katex from "katex";
import {cleanPrototype, PLANTED_EXPANSION} from "../support/proto";

afterEach(cleanPrototype);

describe("legitimate macro handling keeps working", () => {
    it("still expands the caller's own macros", () => {
        const out = katex.renderToString("\\RR", {macros: {"\\RR": "\\mathbb{R}"}, output: "html"});
        expect(out).toBe(katex.renderToString("\\mathbb{R}", {output: "html"}));
    });

    it("still expands macros the caller supplies as functions", () => {
        const macros = {"\\func": () => "X"} as unknown as Record<string, string>;
        const out = katex.renderToString("\\func", {macros, output: "html"});
        expect(out).toBe(katex.renderToString("X", {output: "html"}));
    });

    it("still resolves the built-in macros", () => {
        expect(() => katex.renderToString("\\TeX")).not.toThrow();
        expect(katex.renderToString("\\TeX")).toContain("TeX");
    });

    it("still writes global definitions back into the caller's macro table", () => {
        const macros: Record<string, string> = {};
        katex.renderToString("\\gdef\\foo{1}", {macros});
        expect(macros["\\foo"]).toBeTruthy();
        expect(() => katex.renderToString("\\foo", {macros})).not.toThrow();
    });

    it("still keeps local definitions out of the caller's macro table", () => {
        const macros: Record<string, string> = {};
        expect(() => katex.renderToString("\\def\\foo{1}", {macros})).not.toThrow();
        expect(macros["\\foo"]).toBeFalsy();
    });

    it("still restores a locally redefined macro at the end of its group", () => {
        expect(katex.renderToString("\\def\\x{1}{\\def\\x{2}\\x}\\x", {output: "html"}))
            .toBe(katex.renderToString("\\def\\x{1}{2}1", {output: "html"}));
    });

    it("still lets the caller's own definition win over an inherited entry of the same name", () => {
        (Object.prototype as Record<string, unknown>)["\\RR"] = PLANTED_EXPANSION;
        const out = katex.renderToString("\\RR", {macros: {"\\RR": "\\mathbb{R}"}, output: "html"});
        expect(out).not.toContain("PWNED");
        expect(out).toBe(katex.renderToString("\\mathbb{R}", {output: "html"}));
    });
});
