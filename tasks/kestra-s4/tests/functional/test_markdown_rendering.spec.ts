import {describe, it, expect} from "vitest";
import * as Markdown from "../../../src/utils/markdown";
import {DOCS_OPTIONS, LOG_OPTIONS, toDom} from "../support/helpers";

describe("Markdown rendering: legitimate use", () => {
    it("renders headings, emphasis and tables", async () => {
        const root = toDom(
            await Markdown.render("# Title\n\nSome **bold** text.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n", DOCS_OPTIONS)
        );
        expect(root.querySelector("h1")?.textContent).toBe("Title");
        expect(root.querySelector("strong")?.textContent).toBe("bold");
        expect(root.querySelector("table")).not.toBeNull();
    });

    it("renders a code block with its language label", async () => {
        const root = toDom(await Markdown.render('```yaml\nkey: value\n```\n', DOCS_OPTIONS));
        const block = root.querySelector(".doc-code-block");
        expect(block).not.toBeNull();
        expect(block?.getAttribute("data-language")).toBe("yaml");
        expect(block?.querySelector(".doc-code-language")?.textContent).toBe("YAML");
        expect(block?.querySelector("pre code")?.textContent).toContain("key: value");
    });

    it("keeps raw HTML that documentation Markdown writes directly", async () => {
        const root = toDom(await Markdown.render("A <b>bold</b> word", DOCS_OPTIONS));
        expect(root.querySelector("b")?.textContent).toBe("bold");
    });

    it("turns a bare URL in an execution log into a link", async () => {
        const root = toDom(await Markdown.render("see https://example.com/docs for details", LOG_OPTIONS));
        const anchor = root.querySelector("a");
        expect(anchor?.getAttribute("href")).toBe("https://example.com/docs");
        expect(root.textContent).toContain("for details");
    });
});
