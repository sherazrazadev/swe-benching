import katex from "katex";
import Settings from "../../src/Settings";

describe("legitimate option handling keeps working", () => {
    it("still honours a caller trust function that allowlists a protocol", () => {
        const out = katex.renderToString("\\href{https://example.com/a}{x}", {
            trust: (context: {protocol?: string}) => context.protocol === "https",
        });
        expect(out).toContain('href="https://example.com/a"');
    });

    it("still refuses a protocol the caller's trust function does not list", () => {
        const out = katex.renderToString("\\href{javascript:alert(1)}{x}", {
            trust: (context: {protocol?: string}) => context.protocol === "https",
        });
        expect(out).not.toContain('href="javascript:alert(1)"');
    });

    it("still honours trust: true and a command-specific trust function", () => {
        expect(katex.renderToString("\\href{https://example.com/a}{x}", {trust: true}))
            .toContain('href="https://example.com/a"');
        const onlyUrl = (context: {command?: string}) => context.command === "\\url";
        expect(katex.renderToString("\\url{https://example.com/a}", {trust: onlyUrl}))
            .toContain('href="https://example.com/a"');
        expect(katex.renderToString("\\href{https://example.com/a}{x}", {trust: onlyUrl}))
            .not.toContain('href="https://example.com/a"');
    });

    it("still honours strict as a function, a string and a boolean", () => {
        expect(() => katex.renderToString("é", {strict: () => false})).not.toThrow();
        expect(() => katex.renderToString("é", {strict: "ignore"})).not.toThrow();
        expect(() => katex.renderToString("é", {strict: () => true})).toThrow();
        expect(() => katex.renderToString("é", {strict: "error"})).toThrow();
    });

    it("still falls back to the built-in default when an own entry is undefined", () => {
        expect(() => katex.renderToString("\\error", {throwOnError: undefined})).toThrow();
        const out = katex.renderToString("\\error", {throwOnError: false, errorColor: undefined});
        expect(out).toContain("#cc0000");
    });

    it("still accepts a settings instance as the options object", () => {
        const settings = new Settings({strict: false, trust: true});
        expect(() => katex.renderToString("é", settings)).not.toThrow();
        expect(katex.renderToString("\\href{https://example.com/a}{x}", settings))
            .toContain('href="https://example.com/a"');
    });

    it("still applies the built-in value adjusters to the caller's own entries", () => {
        expect(new Settings({maxSize: -3}).maxSize).toBe(0);
        expect(new Settings({maxExpand: -7}).maxExpand).toBe(0);
        expect(new Settings({minRuleThickness: -1}).minRuleThickness).toBe(0);
        expect(new Settings({maxSize: 5}).maxSize).toBe(5);
    });

    it("still uses the caller's own entry when the shared prototype has one too", () => {
        (Object.prototype as Record<string, unknown>).trust = true;
        try {
            const out = katex.renderToString("\\href{javascript:alert(1)}{x}", {trust: false});
            expect(out).not.toContain('href="javascript:alert(1)"');
        } finally {
            delete (Object.prototype as Record<string, unknown>).trust;
        }
    });
});
