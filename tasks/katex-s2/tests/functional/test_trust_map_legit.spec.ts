import katex from "katex";

describe("a caller's trust map keeps working", () => {
    it("still allows a protocol the caller lists", () => {
        const out = katex.renderToString("\\href{https://example.com/a}{x}", {
            trust: {https: true},
        });
        expect(out).toContain('href="https://example.com/a"');
    });

    it("still refuses a protocol the caller does not list", () => {
        const out = katex.renderToString("\\href{javascript:alert(1)}{x}", {
            trust: {https: true},
        });
        expect(out).not.toContain('href="javascript:alert(1)"');
    });

    it("still honours an entry explicitly set to false", () => {
        const out = katex.renderToString("\\href{https://example.com/a}{x}", {
            trust: {https: false},
        });
        expect(out).not.toContain('href="https://example.com/a"');
    });

    it("still allows a relative URL when the caller lists its marker", () => {
        const out = katex.renderToString("\\href{relative/path}{x}", {
            trust: {_relative: true},
        });
        expect(out).toContain('href="relative/path"');
    });

    it("still handles images and bare URLs through the same map", () => {
        expect(katex.renderToString("\\url{https://example.com/a}", {
            trust: {https: true},
        })).toContain('href="https://example.com/a"');
        expect(katex.renderToString("\\includegraphics{https://example.com/a.png}", {
            trust: {https: true},
        })).toContain('src="https://example.com/a.png"');
    });
});
