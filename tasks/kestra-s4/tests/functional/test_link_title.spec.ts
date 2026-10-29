import {describe, it, expect} from "vitest";
import {mountDocumentation} from "../support/mount";

describe("rendered link titles: legitimate rendering", () => {
    it("shows the link title as text in the tooltip", async () => {
        const wrapper = await mountDocumentation('[docs](https://example.com "Read the docs")');
        const root = wrapper.element as HTMLElement;
        const anchor = root.querySelector("a");
        expect(anchor).not.toBeNull();
        expect(anchor?.getAttribute("title")).toBe("Read the docs");
        const tip = root.querySelector(".doc-link-tip");
        expect(tip).not.toBeNull();
        expect(tip?.textContent).toBe("Read the docs");
        wrapper.unmount();
    });

    it("leaves links without a title alone", async () => {
        const wrapper = await mountDocumentation("[docs](https://example.com)");
        const root = wrapper.element as HTMLElement;
        expect(root.querySelector("a")?.textContent).toBe("docs");
        expect(root.querySelector(".doc-link-tip")).toBeNull();
        wrapper.unmount();
    });
});
