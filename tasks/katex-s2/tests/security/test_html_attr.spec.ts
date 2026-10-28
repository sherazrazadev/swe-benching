import katex from "katex";
import {hasAttribute, cleanPrototype} from "../support/proto";

afterEach(cleanPrototype);

describe("an attribute skips trust only when the library itself lists it", () => {
    it("does not accept an event handler inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).onclick = true;
        const out = katex.renderToString("\\htmlAttr{onclick=alert(1)}{x}", {
            strict: false,
        });
        expect(hasAttribute(out, "onclick")).toBe(false);
    });

    it("does not accept another event handler inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).onmouseover = true;
        const out = katex.renderToString("\\htmlAttr{onmouseover=alert(1)}{x}", {
            strict: false,
        });
        expect(hasAttribute(out, "onmouseover")).toBe(false);
    });

    it("does not accept a third event handler inherited from the shared prototype", () => {
        (Object.prototype as Record<string, unknown>).onfocus = true;
        const out = katex.renderToString("\\htmlAttr{onfocus=alert(1)}{x}", {
            strict: false,
        });
        expect(hasAttribute(out, "onfocus")).toBe(false);
    });
});
