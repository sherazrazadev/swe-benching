// Mounts the product components that render authored Markdown. Each helper installs the
// same router, store and translation plugins the application provides, waits for the
// asynchronous Markdown rendering, and (for the log line) for its post-render enhancement.
import {mount, flushPromises} from "@vue/test-utils";
import {createRouter, createMemoryHistory} from "vue-router";
import {createPinia} from "pinia";
import {createI18n} from "vue-i18n";
import {nextTick} from "vue";
import Markdown from "../../../src/components/layout/Markdown.vue";
import LogLine from "../../../src/components/logs/LogLine.vue";
import ErrorToastContainer from "../../../src/components/ErrorToastContainer.vue";

function makeRouter() {
    return createRouter({
        history: createMemoryHistory(),
        routes: [
            {path: "/:tenant?/executions/:namespace/:flowId/:id/:tab?", name: "executions/update", component: {template: "<div/>"}},
            {path: "/:tenant?/flows/edit/:namespace/:id/:tab?", name: "flows/update", component: {template: "<div/>"}},
            {path: "/flows", name: "flows/list", component: {template: "<div/>"}},
            {path: "/:pathMatch(.*)*", component: {template: "<div/>"}},
        ],
    });
}

async function plugins() {
    const router = makeRouter();
    await router.push("/");
    await router.isReady();
    const i18n = createI18n({legacy: false, locale: "en", messages: {en: {}}, missingWarn: false, fallbackWarn: false});
    return [router, createPinia(), i18n];
}

async function waitFor(predicate: () => boolean, timeout = 8000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        await flushPromises();
    }
    await nextTick();
    await flushPromises();
}

export async function mountDocumentation(source: string): Promise<any> {
    const global = {plugins: await plugins()};
    const wrapper = mount(Markdown as any, {props: {source}, global});
    await waitFor(() => !!(wrapper.element as HTMLElement).querySelector(".markdown p, .markdown h1, .markdown h2"));
    return wrapper;
}

export function logEntry(message: string): any {
    return {
        level: "INFO",
        namespace: "company.team",
        flowId: "flow-one",
        executionId: "execution-one",
        thread: "main",
        index: 0,
        attemptNumber: 1,
        executionKind: "flow",
        timestamp: "2026-01-01T00:00:00Z",
        message,
    };
}

export async function mountLogLine(message: string): Promise<any> {
    const global = {plugins: await plugins()};
    const wrapper = mount(LogLine as any, {props: {log: logEntry(message)}, global});
    await waitFor(() => !!(wrapper.element as HTMLElement).querySelector(".log-content p"));
    // The log line rebuilds its rendered link element after a short delay.
    await new Promise((resolve) => setTimeout(resolve, 400));
    await nextTick();
    await flushPromises();
    return wrapper;
}

export async function mountErrorMessage(message: string): Promise<any> {
    const global = {plugins: await plugins()};
    const wrapper = mount(ErrorToastContainer as any, {props: {message: {message}, items: []}, global});
    await waitFor(() => !!(wrapper.element as HTMLElement).querySelector("p, router-md"));
    return wrapper;
}
