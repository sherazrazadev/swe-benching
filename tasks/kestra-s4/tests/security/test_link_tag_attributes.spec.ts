import {describe, it} from "vitest";
import * as Markdown from "../../../src/utils/markdown";
import {LOG_OPTIONS, toDom, expectInert} from "../support/helpers";
import {mountDocumentation, mountErrorMessage} from "../support/mount";

// The report's own form: an event handler and an overlay style added next to values the
// tag legitimately carries. Each surface that renders authored Markdown is driven through
// the component the product uses.
const PAYLOAD =
    '[[link execution="e1" flowId="f1" namespace="ns1" ' +
    'onmouseover="alert(document.domain)" style="position:fixed;inset:0"]]';

describe("custom link tag: injected values", () => {
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

    it("does not emit an injected handler into a rendered log line", async () => {
        // The log line inserts the renderer's output with v-html before its post-render
        // enhancement runs, so the rendered content itself is what is checked here.
        const root = toDom(await Markdown.render(PAYLOAD, LOG_OPTIONS));
        expectInert(root);
    });

    it("does not emit an injected handler placed before the legitimate values", async () => {
        const wrapper = await mountDocumentation(
            '[[link onfocus="alert(1)" execution="e2" flowId="f2" namespace="ns2"]]'
        );
        expectInert(wrapper.element as HTMLElement);
        wrapper.unmount();
    });
});
