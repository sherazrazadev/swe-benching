import katex from "katex";
import {carriesAttribute, carriesAttributeItem, cleanPrototype} from "../support/proto";

afterEach(cleanPrototype);

describe("legitimate HTML-attribute commands keep working", () => {
    it("still renders an attribute the renderer allows without trust", () => {
        const out = katex.renderToString("\\htmlTooltip{a help text}{x}", {strict: false});
        expect(carriesAttribute(out, "title")).toBe(true);
        expect(out).toContain('title="a help text"');
    });

    it("still renders the allowed attribute when trust is enabled", () => {
        const out = katex.renderToString("\\htmlTooltip{a help text}{x}", {
            trust: true, strict: false,
        });
        expect(out).toContain('title="a help text"');
    });

    it("still renders class, id and style attributes for a trusted render", () => {
        const out = katex.renderToString(
            "\\htmlClass{note}{x}\\htmlId{ident}{x}\\htmlStyle{color:red}{x}",
            {trust: true, strict: false});
        expect(carriesAttributeItem(out, "class", "note")).toBe(true);
        expect(out).toContain('id="ident"');
        expect(out).toContain('style="color:red"');
    });

    it("still refuses an attribute command that has no exemption without trust", () => {
        const out = katex.renderToString("\\htmlClass{note}{x}", {strict: false});
        expect(carriesAttributeItem(out, "class", "note")).toBe(false);
        const idOut = katex.renderToString("\\htmlId{ident}{x}", {strict: false});
        expect(carriesAttribute(idOut, "id")).toBe(false);
    });

    it("still lets a caller's own trust function decide an attribute command", () => {
        const onlyClass = (context: {command?: string; class?: string}) =>
            context.command === "\\htmlClass" && context.class === "note";
        expect(katex.renderToString("\\htmlClass{note}{x}", {trust: onlyClass, strict: false}))
            .toContain('class="enclosing note"');
        expect(katex.renderToString("\\htmlClass{other}{x}", {trust: onlyClass, strict: false}))
            .not.toContain("enclosing other");
    });
});
