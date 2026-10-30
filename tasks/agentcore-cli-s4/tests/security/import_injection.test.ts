/**
 * Hidden security suite: text taken from an imported Bedrock agent definition must
 * never become executable Python in the generated project. Each test imports one
 * hostile definition through the product's shared import handler and then runs the
 * generated project under framework stubs; executing the value would create the
 * marker file.
 */
import { existsSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  importAgent,
  makeActionGroup,
  makeCollaborator,
  makeConfig,
  markerPath,
  runGenerated,
  type Framework,
  type ImportOutcome,
} from '../support/harness';

const FRAMEWORKS: Framework[] = ['Strands', 'LangChain_LangGraph'];

function blocked(outcome: ImportOutcome, marker: string, framework: Framework) {
  // A refused import (an error instead of output) is an acceptable refusal.
  if (!outcome.mainPy) {
    expect(existsSync(marker), `${framework}: import failed but the value still executed`).toBe(false);
    return;
  }
  const run = runGenerated(outcome);
  expect(run.syntax_error, `${framework}: generated project is not valid Python`).toBeNull();
  expect(existsSync(marker), `${framework}: text from the definition executed in the generated project`).toBe(false);
}

describe.each(FRAMEWORKS)('%s: collaborator instruction in the generated description', framework => {
  it('a docstring terminator and a statement are not executed when the tool runs', async () => {
    const marker = markerPath();
    const payload = `""";open("${marker}","w").write("x");#`;
    const config = makeConfig({
      agent: { ...(makeConfig().agent as object), agentCollaboration: 'SUPERVISOR_ROUTER' },
      collaborators: [makeCollaborator(payload)],
    });
    const outcome = await importAgent(config, framework);
    try {
      blocked(outcome, marker, framework);
    } finally {
      outcome.cleanup();
    }
  });
});

describe.each(FRAMEWORKS)('%s: imported agent description in the generated header', framework => {
  it('a line break and a statement are not executed', async () => {
    const marker = markerPath();
    const payload = `Imported note.\nopen("${marker}","w").write("x")`;
    const config = makeConfig({ agent: { ...(makeConfig().agent as object), description: payload } });
    const outcome = await importAgent(config, framework);
    try {
      blocked(outcome, marker, framework);
    } finally {
      outcome.cleanup();
    }
  });
});

describe.each(FRAMEWORKS)('%s: imported action group description in generated metadata', framework => {
  it('a quote that ends the literal and a statement are not executed', async () => {
    const marker = markerPath();
    const payload = `safe", open("${marker}","w").write("x"), "`;
    const config = makeConfig({ action_groups: [makeActionGroup(payload, undefined)] });
    const outcome = await importAgent(config, framework);
    try {
      blocked(outcome, marker, framework);
    } finally {
      outcome.cleanup();
    }
  });
});

describe.each(FRAMEWORKS)('%s: imported parameter description in generated metadata', framework => {
  it('an embedded expression is not evaluated at import time', async () => {
    const marker = markerPath();
    const payload = `{open('${marker}','w').write('x')}`;
    const config = makeConfig({ action_groups: [makeActionGroup(undefined, payload)] });
    const outcome = await importAgent(config, framework);
    try {
      blocked(outcome, marker, framework);
    } finally {
      outcome.cleanup();
    }
  });
});
