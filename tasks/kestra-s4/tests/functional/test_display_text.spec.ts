import {describe, it, expect} from "vitest";
import * as Markdown from "../../../src/utils/markdown";
import linkify from "../../../src/components/logs/linkify";
import {LOG_OPTIONS, recordingRouter, toDom} from "../support/helpers";

describe("custom link tag: display text", () => {
    it("shows the display text instead of the raw execution id", async () => {
        const root = toDom(
            await Markdown.render(
                '[[link execution="e1" flowId="f1" namespace="ns1" label="Retry the failed run"]]',
                LOG_OPTIONS
            )
        );
        const router = recordingRouter();
        linkify(root, router);

        const anchors = Array.from(root.querySelectorAll("a"));
        expect(anchors[0]?.textContent).toBe("Retry the failed run");
        expect(anchors[1]?.textContent).toBe("ns1.f1");
        expect(router.calls[0]).toEqual({
            name: "executions/update",
            params: {id: "e1", namespace: "ns1", flowId: "f1"},
        });
    });

    it("still shows the execution id when no display text is given", async () => {
        const root = toDom(await Markdown.render('[[link execution="e2" flowId="f2" namespace="ns2"]]', LOG_OPTIONS));
        linkify(root, recordingRouter());
        expect(root.querySelector("a")?.textContent).toBe("e2");
    });
});
