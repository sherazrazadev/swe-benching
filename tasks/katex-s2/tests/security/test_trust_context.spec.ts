import katex from "katex";
import {
    ATTACK_URL, carriesAttributeItem, carriesUrlAsAttribute, cleanPrototype,
} from "../support/proto";

afterEach(cleanPrototype);

const allowHttps = (context: {protocol?: string}) => context.protocol === "https";

describe("the trust decision is made from the caller's own request", () => {
    it("does not accept a protocol inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).protocol = "https";
        const out = katex.renderToString(`\\href{${ATTACK_URL}}{x}`, {trust: allowHttps});
        expect(carriesUrlAsAttribute(out, ATTACK_URL)).toBe(false);
    });

    it("does not accept an inherited protocol for a bare URL command", () => {
        (Object.prototype as Record<string, unknown>).protocol = "https";
        const out = katex.renderToString(`\\url{${ATTACK_URL}}`, {trust: allowHttps});
        expect(carriesUrlAsAttribute(out, ATTACK_URL)).toBe(false);
    });

    it("does not give a context that carries no URL a protocol borrowed from the prototype", () => {
        (Object.prototype as Record<string, unknown>).url = "https://allowed.example/";
        const trust = (context: Record<string, unknown>) => context.protocol === "https";
        const out = katex.renderToString("\\htmlClass{owned}{x}", {trust, strict: false});
        expect(carriesAttributeItem(out, "class", "owned")).toBe(false);
    });

    it("does not show a context with no URL a protocol inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).protocol = "https";
        const trust = (context: Record<string, unknown>) => context.protocol === "https";
        const out = katex.renderToString("\\htmlClass{owned}{x}", {trust, strict: false});
        expect(carriesAttributeItem(out, "class", "owned")).toBe(false);
    });

    it("does not accept an inherited URL for a command that takes no URL", () => {
        (Object.prototype as Record<string, unknown>).url = "https://allowed.example/";
        const seen: string[][] = [];
        const trust = (context: Record<string, unknown>) => {
            seen.push(Object.keys(context));
            return context.protocol === "https";
        };
        const out = katex.renderToString("\\htmlId{owned}{x}", {trust, strict: false});
        expect(carriesAttributeItem(out, "id", "owned")).toBe(false);
        for (const keys of seen) {
            expect(keys).not.toContain("url");
            expect(keys).not.toContain("protocol");
        }
    });
});
