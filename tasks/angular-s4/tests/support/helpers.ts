import {
  ApplicationRef,
  Component,
  ComponentRef,
  createComponent,
  Directive,
  EnvironmentInjector,
  inject,
  Type,
} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';

let uid = 0;
export function nextId(): number {
  return ++uid;
}

export interface Outcome<T = any> {
  error: unknown | null;
  fixture: ComponentFixture<T> | null;
}

export function capture<T>(fn: () => ComponentFixture<T>): Outcome<T> {
  try {
    return {error: null, fixture: fn()};
  } catch (e) {
    return {error: e, fixture: null};
  }
}

export async function render<T>(
  component: Type<T>,
): Promise<{error: unknown | null; fixture: ComponentFixture<T> | null}> {
  try {
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();
    return {error: null, fixture};
  } catch (e) {
    return {error: e, fixture: null};
  }
}

export interface DynOutcome {
  error: unknown | null;
  element: Element;
  ref: ComponentRef<unknown> | null;
}

/** Creates a root component over an arbitrary host element, with the given directives applied. */
export async function renderDynamic(
  hostElement: Element,
  directives: any[],
  bindings: any[] = [],
): Promise<DynOutcome> {
  const selector = 'probe-dynamic-' + nextId();
  @Component({selector, template: ''})
  class DynamicHostComponent {}

  @Component({selector: 'probe-app-' + nextId(), template: ''})
  class DynamicApp {
    ref: ComponentRef<unknown> | null = null;
    constructor() {
      this.ref = createComponent(DynamicHostComponent, {
        hostElement,
        environmentInjector: inject(EnvironmentInjector),
        directives,
      });
      inject(ApplicationRef).attachView(this.ref.hostView);
    }
  }

  const outcome = await render(DynamicApp);
  const ref = outcome.fixture?.componentInstance.ref ?? null;
  return {error: outcome.error, element: hostElement, ref};
}

export function dir(selector: string, host: Record<string, string>): Type<unknown> {
  @Directive({selector, host})
  class ProbeDirective {}
  return ProbeDirective;
}

export function carrier(selector: string, inner: Type<unknown>): Type<unknown> {
  @Directive({selector, hostDirectives: [inner]})
  class ProbeCarrier {}
  return ProbeCarrier;
}

/** A directive whose host binding reads a property of the directive instance. */
export function dirWithValue(
  selector: string,
  host: Record<string, string>,
  key: string,
  value: unknown,
): Type<unknown> {
  @Directive({selector, host})
  class ProbeValueDirective {}
  Object.defineProperty(ProbeValueDirective.prototype, key, {value, writable: true});
  return ProbeValueDirective;
}

export function query(fixture: ComponentFixture<unknown> | null, selector: string): Element | null {
  return fixture ? (fixture.nativeElement as Element).querySelector(selector) : null;
}

export function getAttribute(
  fixture: ComponentFixture<unknown> | null,
  selector: string,
  name: string,
): string | null {
  const el = query(fixture, selector);
  return el ? el.getAttribute(name) : null;
}

/** Creates a specific component type over an arbitrary host element. */
export async function renderComponentOn<T>(
  hostElement: Element,
  componentType: Type<T>,
): Promise<{error: unknown | null; ref: ComponentRef<T> | null}> {
  @Component({selector: 'probe-app-' + nextId(), template: ''})
  class HostApp {
    ref: ComponentRef<T> | null = null;
    constructor() {
      this.ref = createComponent(componentType, {
        hostElement,
        environmentInjector: inject(EnvironmentInjector),
      });
      inject(ApplicationRef).attachView(this.ref!.hostView);
    }
  }
  const outcome = await render(HostApp);
  return {error: outcome.error, ref: outcome.fixture?.componentInstance.ref ?? null};
}

export function reset(): void {
  TestBed.resetTestingModule();
}
