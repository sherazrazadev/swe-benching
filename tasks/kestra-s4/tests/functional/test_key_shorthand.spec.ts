import {describe, it, expect} from "vitest";
import * as Markdown from "../../../src/utils/markdown";
import {DOCS_OPTIONS, toDom} from "../support/helpers";

describe("documentation shorthand: legitimate rendering", () => {
    it("renders a key cap with its visible text", async () => {
        const root = toDom(await Markdown.render('Press ::key{key="Ctrl+S"} to save', DOCS_OPTIONS));
        const key = root.querySelector("kbd.doc-key");
        expect(key).not.toBeNull();
        expect(key?.textContent).toBe("Ctrl+S");
        expect(root.textContent).toContain("Press");
        expect(root.textContent).toContain("to save");
    });

    it("renders several shorthands in one paragraph", async () => {
        const root = toDom(await Markdown.render('Use ::key{key="Cmd"} + ::key{key="K"}', DOCS_OPTIONS));
        const keys = Array.from(root.querySelectorAll("kbd.doc-key")).map((k) => k.textContent);
        expect(keys).toEqual(["Cmd", "K"]);
    });
});
