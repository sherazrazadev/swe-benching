import katex from "katex";
import {ATTACK_URL, carriesUrlAsAttribute, cleanPrototype} from "../support/proto";

afterEach(cleanPrototype);

describe("a caller's trust map allows only the entries the caller wrote", () => {
    it("does not allow a protocol inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).javascript = true;
        const out = katex.renderToString(`\\href{${ATTACK_URL}}{x}`, {
            trust: {https: true},
        });
        expect(carriesUrlAsAttribute(out, ATTACK_URL)).toBe(false);
    });

    it("does not allow an inherited protocol for a bare URL command", () => {
        (Object.prototype as Record<string, unknown>).javascript = true;
        const out = katex.renderToString(`\\url{${ATTACK_URL}}`, {
            trust: {https: true},
        });
        expect(carriesUrlAsAttribute(out, ATTACK_URL)).toBe(false);
    });

    it("does not allow an inherited protocol for an image command", () => {
        (Object.prototype as Record<string, unknown>).javascript = true;
        const out = katex.renderToString(`\\includegraphics{${ATTACK_URL}}`, {
            trust: {https: true},
        });
        expect(carriesUrlAsAttribute(out, ATTACK_URL)).toBe(false);
    });

    it("does not allow an inherited protocol when the caller's map is empty", () => {
        (Object.prototype as Record<string, unknown>).https = true;
        const out = katex.renderToString("\\href{https://example.com/a}{x}", {
            trust: {},
        });
        expect(carriesUrlAsAttribute(out, "https://example.com/a")).toBe(false);
    });
});
