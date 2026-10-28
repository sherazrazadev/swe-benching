import katex from "katex";

describe("legitimate HTML attribute use keeps working", () => {
    it("still sets a listed attribute without enabling trust", () => {
        const out = katex.renderToString("\\htmlAttr{title=hello}{x}", {
            strict: false,
        });
        expect(out).toContain('title="hello"');
    });

    it("still sets the other listed attributes without enabling trust", () => {
        expect(katex.renderToString("\\htmlAttr{role=note}{x}", {strict: false}))
            .toContain('role="note"');
        expect(katex.renderToString("\\htmlAttr{aria-label=note}{x}", {strict: false}))
            .toContain('aria-label="note"');
    });

    it("still refuses an unlisted attribute when the page does not trust input", () => {
        const out = katex.renderToString("\\htmlAttr{onclick=alert(1)}{x}", {
            strict: false,
        });
        expect(out).not.toMatch(/onclick\s*=\s*"/);
    });

    it("still sets an unlisted attribute when the page enables trust", () => {
        const out = katex.renderToString("\\htmlAttr{onclick=alert(1)}{x}", {
            strict: false,
            trust: true,
        });
        expect(out).toContain('onclick="alert(1)"');
    });

    it("still renders the body of the attribute command", () => {
        const out = katex.renderToString("\\htmlAttr{title=hello}{x^2}", {
            strict: false,
        });
        expect(out).toContain('title="hello"');
        expect(out).toContain("katex");
    });
});
