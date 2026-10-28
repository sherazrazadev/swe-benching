import katex from "katex";
import {carriesAttributeItem, cleanPrototype} from "../support/proto";

afterEach(cleanPrototype);

describe("an attribute exemption is decided from the renderer's own table", () => {
    it("does not let an inherited entry exempt a class attribute", () => {
        (Object.prototype as Record<string, unknown>).class = true;
        const out = katex.renderToString("\\htmlClass{owned}{x}", {strict: false});
        expect(carriesAttributeItem(out, "class", "owned")).toBe(false);
    });

    it("does not let an inherited entry exempt an id attribute", () => {
        (Object.prototype as Record<string, unknown>).id = true;
        const out = katex.renderToString("\\htmlId{owned}{x}", {strict: false});
        expect(out).not.toContain('id="owned"');
    });

    it("does not let an inherited entry exempt a style attribute", () => {
        (Object.prototype as Record<string, unknown>).style = true;
        const out = katex.renderToString("\\htmlStyle{color:red}{x}", {strict: false});
        expect(out).not.toContain('style="color:red"');
    });
});
