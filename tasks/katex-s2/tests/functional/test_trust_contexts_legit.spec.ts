import katex from "katex";

describe("legitimate trust contexts keep working", () => {
    it("still passes the derived protocol of an absolute URL to the trust function", () => {
        let seen: Record<string, unknown> = {};
        katex.renderToString("\\href{https://example.com/a}{x}", {
            trust: (context: Record<string, unknown>) => {
                seen = {...context};
                return false;
            },
        });
        expect(seen.command).toBe("\\href");
        expect(seen.url).toBe("https://example.com/a");
        expect(seen.protocol).toBe("https");
    });

    it("still passes a relative protocol marker to the trust function", () => {
        let protocol: unknown;
        katex.renderToString("\\href{relative/path}{x}", {
            trust: (context: {protocol?: string}) => {
                protocol = context.protocol;
                return false;
            },
        });
        expect(protocol).toBe("_relative");
    });

    it("still lets a trust function decide HTML commands from their own fields", () => {
        const onlyClass = (context: {command?: string; class?: string}) =>
            context.command === "\\htmlClass" && context.class === "note";
        expect(katex.renderToString("\\htmlClass{note}{x}", {trust: onlyClass, strict: false}))
            .toMatch(/class="[^"]*\bnote\b/);
        expect(katex.renderToString("\\htmlClass{other}{x}", {trust: onlyClass, strict: false}))
            .not.toMatch(/class="[^"]*\bother\b/);
        expect(katex.renderToString("\\htmlId{ident}{x}", {trust: onlyClass, strict: false}))
            .not.toContain('id="ident"');
    });

    it("still gives an HTML command context no protocol of its own", () => {
        const seen: Array<Record<string, unknown>> = [];
        katex.renderToString("\\htmlId{ident}{x}", {
            strict: false,
            trust: (context: Record<string, unknown>) => {
                seen.push({...context});
                return true;
            },
        });
        expect(seen.length).toBe(1);
        expect(seen[0].id).toBe("ident");
        expect("protocol" in seen[0]).toBe(false);
        expect("url" in seen[0]).toBe(false);
    });

    it("still renders a link the caller's trust function allows", () => {
        const out = katex.renderToString("\\url{https://example.com/a}", {
            trust: (context: {protocol?: string}) => context.protocol === "https",
        });
        expect(out).toContain('href="https://example.com/a"');
    });
});
