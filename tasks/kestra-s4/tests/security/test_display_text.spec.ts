import {describe, it} from "vitest";
import {expectInert} from "../support/helpers";
import {mountLogLine} from "../support/mount";

// A custom display text is a legitimate value of the link tag. The rendered log line
// consumes it after the Markdown layer has produced its output, so the value is checked
// on the DOM the product actually builds.
const PAYLOAD =
    '[[link execution="e1" flowId="f1" namespace="ns1" ' +
    'label="<img src=x onerror=alert(1)>"]]';

describe("custom link display text", () => {
    it("does not turn a markup-looking display text into an element", async () => {
        const wrapper = await mountLogLine(PAYLOAD);
        expectInert(wrapper.element as HTMLElement);
        wrapper.unmount();
    });

    it("does not turn a script element in the display text into an element", async () => {
        const wrapper = await mountLogLine(
            '[[link execution="e2" flowId="f2" namespace="ns2" label="<script>alert(1)</script>"]]'
        );
        expectInert(wrapper.element as HTMLElement);
        wrapper.unmount();
    });
});
