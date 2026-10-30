/**
 * Hidden functional suite: legitimate imports keep producing a working project with
 * their text preserved. These assertions hold on the unmodified project as well as on
 * a correct fix, so an over-broad fix that removes or double-escapes imported text
 * fails here.
 */
import { describe, expect, it } from 'vitest';
import {
  importAgent,
  makeActionGroup,
  makeCollaborator,
  makeConfig,
  runGenerated,
  type Framework,
} from '../support/harness';

const FRAMEWORKS: Framework[] = ['Strands', 'LangChain_LangGraph'];

describe.each(FRAMEWORKS)('%s: legitimate import', framework => {
  it('generates a runnable project for a simple agent', async () => {
    const outcome = await importAgent(makeConfig(), framework);
    try {
      expect(outcome.success, outcome.error).toBe(true);
      expect(outcome.mainPy.length).toBeGreaterThan(0);
      const run = runGenerated(outcome);
      expect(run.syntax_error).toBeNull();
      expect(run.run_error).toBeNull();
      expect(run.signatures.invoke_agent).toContain('question');
      if (framework === 'Strands') {
        expect(outcome.mainPy).toContain('from strands import Agent, tool');
      } else {
        expect(outcome.mainPy).toContain('from langchain.tools import tool');
      }
    } finally {
      outcome.cleanup();
    }
  });
});

describe.each(FRAMEWORKS)('%s: collaborator instruction preservation', framework => {
  it('keeps backslashes and quotes in the generated text without escaping them twice', async () => {
    const instruction = "Use C:\\path\\to\\file and regex \\d+ for the 'billing' flow.";
    const config = makeConfig({
      agent: { ...(makeConfig().agent as object), agentCollaboration: 'SUPERVISOR_ROUTER' },
      collaborators: [makeCollaborator(instruction)],
    });
    const outcome = await importAgent(config, framework);
    try {
      expect(outcome.success, outcome.error).toBe(true);
      const run = runGenerated(outcome);
      expect(run.syntax_error).toBeNull();
      expect(run.docs.invoke_collab).toBeDefined();
      expect(run.docs.invoke_collab).toContain(instruction);
      expect(run.docs.invoke_collab).not.toContain('C:\\\\path');
    } finally {
      outcome.cleanup();
    }
  });
});

describe.each(FRAMEWORKS)('%s: imported agent description preservation', framework => {
  it('keeps the description in the generated header', async () => {
    const description = 'Billing support assistant for the finance team.';
    const outcome = await importAgent(
      makeConfig({ agent: { ...(makeConfig().agent as object), description } }),
      framework
    );
    try {
      expect(outcome.success, outcome.error).toBe(true);
      const headerLine = outcome.mainPy
        .split('\n')
        .find(line => line.trimStart().startsWith('#') && line.includes(description));
      expect(headerLine, 'the imported description is no longer recorded in the generated project').toBeDefined();
      const run = runGenerated(outcome);
      expect(run.syntax_error).toBeNull();
    } finally {
      outcome.cleanup();
    }
  });
});

describe.each(FRAMEWORKS)('%s: imported action group description preservation', framework => {
  it('keeps the description as a string value without altering it', async () => {
    const description = "Handles the 'weather' feed and \\d+ lookups.";
    const outcome = await importAgent(makeConfig({ action_groups: [makeActionGroup(description, undefined)] }), framework);
    try {
      expect(outcome.success, outcome.error).toBe(true);
      const run = runGenerated(outcome);
      expect(run.syntax_error).toBeNull();
      expect(run.lists.ACTION_GROUP_NOTES).toBeDefined();
      expect(run.lists.ACTION_GROUP_NOTES).toContain(description);
    } finally {
      outcome.cleanup();
    }
  });
});

describe.each(FRAMEWORKS)('%s: imported parameter description preservation', framework => {
  it('keeps the description as a readable string value', async () => {
    const description = "City name, for example 'Paris' or 'Berlin'.";
    const outcome = await importAgent(makeConfig({ action_groups: [makeActionGroup(undefined, description)] }), framework);
    try {
      expect(outcome.success, outcome.error).toBe(true);
      const run = runGenerated(outcome);
      expect(run.syntax_error).toBeNull();
      expect(run.lists.PARAMETER_NOTES).toBeDefined();
      expect(run.lists.PARAMETER_NOTES.some(note => note.includes(description))).toBe(true);
    } finally {
      outcome.cleanup();
    }
  });
});

describe.each(FRAMEWORKS)('%s: action group tool generation', framework => {
  it('generates a callable tool with its parameters and description', async () => {
    const config = makeConfig({
      action_groups: [
        makeActionGroup(undefined, 'City name') as Record<string, unknown>,
      ],
    });
    const outcome = await importAgent(config, framework);
    try {
      expect(outcome.success, outcome.error).toBe(true);
      const run = runGenerated(outcome);
      expect(run.syntax_error).toBeNull();
      expect(run.signatures.get_weather).toContain('location');
      expect(run.docs.get_weather).toContain('Get the current weather.');
      expect(outcome.mainPy).toContain('weather_tools');
    } finally {
      outcome.cleanup();
    }
  });
});
