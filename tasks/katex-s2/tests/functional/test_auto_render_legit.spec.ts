/**
 * @jest-environment jsdom
 */
import renderMathInElement from "katex/contrib/auto-render";

describe("legitimate auto-render use keeps working", () => {
    it("still renders the default delimiters", () => {
        const element = document.createElement("div");
        element.textContent = "before $$x^2$$ after";
        renderMathInElement(element);
        expect(element.querySelector(".katex")).not.toBeNull();
        expect(element.textContent).toContain("before");
        expect(element.textContent).toContain("after");
    });

    it("still accepts caller-supplied delimiters", () => {
        const element = document.createElement("div");
        element.textContent = "[[x]]";
        renderMathInElement(element, {
            delimiters: [{left: "[[", right: "]]", display: false}],
        });
        expect(element.querySelector(".katex")).not.toBeNull();
    });

    it("still accepts a caller-supplied macro table", () => {
        const element = document.createElement("div");
        element.textContent = "$$\\RR$$";
        renderMathInElement(element, {macros: {"\\RR": "\\mathbb{R}"}});
        expect(element.querySelector(".katex")).not.toBeNull();
        expect(element.innerHTML).not.toContain("katex-error");
    });

    it("still skips ignored tags and ignored classes", () => {
        const element = document.createElement("div");
        element.innerHTML =
            "<pre>$$a$$</pre><span class=\"skip\">$$b$$</span><span>$$c$$</span>";
        renderMathInElement(element, {ignoredClasses: ["skip"]});
        expect(element.querySelector("pre .katex")).toBeNull();
        expect(element.querySelector("span.skip .katex")).toBeNull();
        expect(element.querySelectorAll(".katex").length).toBe(1);
    });

    it("still calls the caller's error callback and keeps the source text", () => {
        const element = document.createElement("div");
        element.textContent = "$$\\notacommand$$";
        let calls = 0;
        renderMathInElement(element, {
            errorCallback: () => { calls += 1; },
        });
        expect(calls).toBeGreaterThan(0);
        expect(element.textContent).toContain("\\notacommand");
    });
});
