import katex from "katex";
import {ATTACK_URL, carriesUrlAsAttribute, cleanPrototype} from "../support/proto";

afterEach(cleanPrototype);

describe("the renderer's own defaults only come from the renderer", () => {
    it("ignores a default entry inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).default = {};
        const out = katex.renderToString(`\\href{${ATTACK_URL}}{x}`);
        expect(carriesUrlAsAttribute(out, ATTACK_URL)).toBe(false);
    });

    it("ignores a default entry inherited from the shared prototype for a bare URL command", () => {
        (Object.prototype as Record<string, unknown>).default = {};
        const out = katex.renderToString(`\\url{${ATTACK_URL}}`);
        expect(carriesUrlAsAttribute(out, ATTACK_URL)).toBe(false);
    });

    it("ignores a value adjuster inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).processor = () => true;
        const out = katex.renderToString(`\\href{${ATTACK_URL}}{x}`, {trust: false});
        expect(carriesUrlAsAttribute(out, ATTACK_URL)).toBe(false);
    });
});
