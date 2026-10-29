import {describe, it} from "vitest";
import {expectInert} from "../support/helpers";
import {mountDocumentation, mountErrorMessage} from "../support/mount";

// A documentation shorthand is expanded before the Markdown parser runs. Its argument is
// author text and must stay text in every surface that renders it. The execution log line
// sanitises the raw message before Markdown sees it, so the shorthand's argument cannot
// reach that surface as markup and it is not exercised there.
const PAYLOAD = 'Press ::key{key="<img src=x onerror="alert(1)">"} to continue';

describe("documentation shorthand arguments", () => {
    it("does not emit an injected handler from a rendered description", async () => {
        const wrapper = await mountDocumentation(PAYLOAD);
        expectInert(wrapper.element as HTMLElement);
        wrapper.unmount();
    });

    it("does not emit an injected handler from a rendered error message", async () => {
        const wrapper = await mountErrorMessage(PAYLOAD);
        expectInert(wrapper.element as HTMLElement);
        wrapper.unmount();
    });
});
