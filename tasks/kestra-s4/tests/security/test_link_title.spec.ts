import {describe, it} from "vitest";
import {mountDocumentation} from "../support/mount";
import {expectInert} from "../support/helpers";

// A link title is author text. The documentation component enhances rendered links after
// the Markdown layer has produced (and escaped) its HTML, so the value is checked on the
// component's final DOM.
const PAYLOAD = '[click me](https://example.com "<img src=x onerror=alert(1)>")';

describe("rendered link titles", () => {
    it("does not turn a markup-looking link title into an element", async () => {
        const wrapper = await mountDocumentation(PAYLOAD);
        expectInert(wrapper.element as HTMLElement);
        wrapper.unmount();
    });
});
