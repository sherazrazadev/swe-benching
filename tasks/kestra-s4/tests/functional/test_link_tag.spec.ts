import {describe, it, expect} from "vitest";
import * as Markdown from "../../../src/utils/markdown";
import linkify from "../../../src/components/logs/linkify";
import {DOCS_OPTIONS, recordingRouter, toDom, attributesOf} from "../support/helpers";

const SOURCE = '[[link execution="e1" flowId="f1" namespace="ns1"]]';

describe("custom link tag: legitimate rendering", () => {
    it("keeps the values the product reads from the tag", async () => {
        const root = toDom(await Markdown.render(SOURCE, DOCS_OPTIONS));
        const tag = root.querySelector("router-md");
        expect(tag).not.toBeNull();
        expect(attributesOf(tag)).toMatchObject({
            execution: "e1",
            // HTML attribute names are lower-cased in the parsed document
            flowid: "f1",
            namespace: "ns1",
        });
    });

    it("builds the execution anchor and the flow anchor from those values", async () => {
        const root = toDom(await Markdown.render(SOURCE, DOCS_OPTIONS));
        const router = recordingRouter();
        linkify(root, router);

        const anchors = Array.from(root.querySelectorAll("a"));
        expect(anchors.map((a) => a.textContent)).toEqual(["e1", "ns1.f1"]);
        expect(root.textContent).toContain(" for flow ");
        expect(router.calls).toEqual([
            {name: "executions/update", params: {id: "e1", namespace: "ns1", flowId: "f1"}},
            {name: "flows/update", params: {namespace: "ns1", id: "f1"}},
        ]);
    });

    it("keeps a tag with no parsable values as literal text", async () => {
        const root = toDom(await Markdown.render("a [[link]] b", DOCS_OPTIONS));
        expect(root.querySelector("router-md")).toBeNull();
        expect(root.textContent).toContain("[[link]]");
    });
});
