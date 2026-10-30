/**
 * Test support for the AgentCore import suites.
 *
 * Drives the product's shared import handler with a stubbed Bedrock fetch so the
 * generated Python project is produced exactly as the CLI/TUI produces it, then
 * runs that generated project under small Python stand-ins for the two agent
 * frameworks. All bookkeeping (fixtures, expected values, stubs, clean-up) lives
 * here or in the tests; no product helper computes an expected value.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { vi } from 'vitest';

process.env.AGENTCORE_SKIP_INSTALL = '1';

const mockState = vi.hoisted(() => ({ config: null as unknown }));

vi.mock('../../src/cli/aws/bedrock-import', () => ({
  getBedrockAgentConfig: async () => mockState.config,
}));

export type Framework = 'Strands' | 'LangChain_LangGraph';

export function baseAgent(overrides: Record<string, unknown> = {}) {
  return {
    agentId: 'agent-1',
    agentName: 'ImportedAgent',
    agentArn: 'arn:aws:bedrock:us-east-1:123456789012:agent/agent-1',
    foundationModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
    instruction: 'You are a helpful assistant.',
    orchestrationType: 'DEFAULT',
    agentCollaboration: 'DISABLED',
    model: { providerName: 'Anthropic', modelId: 'claude-3-sonnet' },
    ...overrides,
  };
}

export function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    agent: baseAgent(),
    action_groups: [],
    knowledge_bases: [],
    collaborators: [],
    ...overrides,
  } as Record<string, any>;
}

export function makeCollaborator(instruction: string, overrides: Record<string, unknown> = {}) {
  return {
    agent: baseAgent({ agentId: 'collab-1', agentName: 'CollaboratorAgent', instruction: 'Collaborator instructions.' }),
    action_groups: [],
    knowledge_bases: [],
    collaborators: [],
    collaboratorName: 'collab',
    collaborationInstruction: instruction,
    relayConversationHistory: 'DISABLED',
    ...overrides,
  } as Record<string, any>;
}

export function makeActionGroup(description: string | undefined, parameterDescription: string | undefined) {
  const parameters: Record<string, unknown> = {};
  if (parameterDescription !== undefined) {
    parameters.location = { type: 'string', description: parameterDescription, required: true };
  }
  return {
    actionGroupId: 'ag-1',
    actionGroupName: 'weather_tools',
    actionGroupState: 'ENABLED',
    description,
    functionSchema: {
      functions: [
        {
          name: 'get_weather',
          description: 'Get the current weather.',
          parameters,
        },
      ],
    },
  } as Record<string, any>;
}

export interface ImportOutcome {
  success: boolean;
  error?: string;
  agentPath: string;
  files: Record<string, string>;
  mainPy: string;
  cleanup: () => void;
}

export async function importAgent(config: Record<string, unknown>, framework: Framework): Promise<ImportOutcome> {
  mockState.config = config; // the stubbed Bedrock fetch returns this definition
  const { executeImportAgent } = await import('../../src/cli/operations/agent/import');
  const base = mkdtempSync(join(tmpdir(), 'agentcore-import-'));
  const name = 'demo';
  const result: any = await executeImportAgent({
    name,
    framework: framework as never,
    memory: 'none' as never,
    bedrockRegion: 'us-east-1',
    bedrockAgentId: 'agent-1',
    bedrockAliasId: 'alias-1',
    configBaseDir: join(base, 'agentcore'),
  });
  const agentPath = join(base, 'app', name);
  const files: Record<string, string> = {};
  if (existsSync(agentPath)) {
    for (const entry of readdirSync(agentPath)) {
      if (entry.endsWith('.py')) files[entry] = readFileSync(join(agentPath, entry), 'utf-8');
    }
  }
  return {
    success: !!result?.success,
    error: result?.error ? String(result.error?.message ?? result.error) : undefined,
    agentPath,
    files,
    mainPy: files['main.py'] ?? '',
    cleanup: () => rmSync(base, { recursive: true, force: true }),
  };
}

/** A fresh marker path for one test; the payload writes it only if it executes. */
export function markerPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agentcore-marker-'));
  return join(dir, 'executed.marker');
}

const STUBS: Record<string, string> = {
  'stubs/strands/__init__.py': `
def tool(fn=None, **kwargs):
    if callable(fn):
        return fn
    return lambda g: g

class _Result:
    def __str__(self):
        return "stub-result"
    class _Metrics:
        tool_metrics = {}
    metrics = _Metrics()

class Agent:
    def __init__(self, *args, **kwargs):
        self.messages = []
    def __call__(self, *args, **kwargs):
        return _Result()
`,
  'stubs/strands/agent/__init__.py': '',
  'stubs/strands/agent/conversation_manager.py': 'class SlidingWindowConversationManager:\n    def __init__(self, *a, **k):\n        pass\n',
  'stubs/strands/models.py': 'class BedrockModel:\n    def __init__(self, *a, **k):\n        pass\n',
  'stubs/strands/types/__init__.py': '',
  'stubs/strands/types/content.py': 'Message = dict\n',
  'stubs/boto3.py': 'def client(*args, **kwargs):\n    return object()\n',
  'stubs/bedrock_agentcore/__init__.py': '',
  'stubs/bedrock_agentcore/runtime.py': `
class BedrockAgentCoreApp:
    def entrypoint(self, fn):
        return fn
    def run(self):
        pass
`,
  'stubs/langchain_aws/__init__.py': 'class ChatBedrock:\n    def __init__(self, *a, **k):\n        pass\n',
  'stubs/langchain_aws/retrievers.py': `
class AmazonKnowledgeBasesRetriever:
    def __init__(self, *a, **k):
        pass
    def as_tool(self, *a, **k):
        return None
`,
  'stubs/langchain_core/__init__.py': '',
  'stubs/langchain_core/messages.py': `
class _Message:
    def __init__(self, *a, **k):
        self.name = "message"
class HumanMessage(_Message):
    pass
class SystemMessage(_Message):
    pass
class AIMessage(_Message):
    pass
class ToolMessage(_Message):
    pass
`,
  'stubs/langchain_core/globals.py': 'def set_verbose(*a, **k):\n    pass\ndef set_debug(*a, **k):\n    pass\n',
  'stubs/langchain/__init__.py': '',
  'stubs/langchain/tools.py': `
def tool(fn=None, **kwargs):
    if callable(fn):
        return fn
    return lambda g: g
`,
  'stubs/langgraph/__init__.py': '',
  'stubs/langgraph/prebuilt.py': `
InjectedState = "injected-state"

class _Agent:
    def ainvoke(self, payload, config=None):
        async def _run():
            from langchain_core.messages import AIMessage
            return {"messages": [AIMessage("stub")]}
        return _run()
    def update_state(self, *a, **k):
        pass

def create_react_agent(*a, **k):
    return _Agent()
`,
  'stubs/langgraph/checkpoint/__init__.py': '',
  'stubs/langgraph/checkpoint/memory.py': 'class InMemorySaver:\n    def __init__(self, *a, **k):\n        pass\n',
  'stubs/opentelemetry/__init__.py': '',
  'stubs/opentelemetry/instrumentation/__init__.py': '',
  'stubs/opentelemetry/instrumentation/langchain.py': `
class LangchainInstrumentor:
    def instrument(self, *a, **k):
        pass
`,
};

const RUNNER = `
import json, os, sys, inspect

agent_dir, out_path = sys.argv[1], sys.argv[2]
sys.path.insert(0, agent_dir)
res = {"syntax_error": None, "run_error": None, "call_error": None,
       "docs": {}, "strings": {}, "lists": {}, "signatures": {}}
main = os.path.join(agent_dir, "main.py")
src = open(main, encoding="utf-8").read()
try:
    code = compile(src, "main.py", "exec")
except SyntaxError as e:
    res["syntax_error"] = "%s: %s (line %s)" % (type(e).__name__, e.msg, e.lineno)
    open(out_path, "w").write(json.dumps(res))
    sys.exit(0)

g = {"__name__": "__imported_agent__", "__file__": main}
try:
    exec(code, g)
except BaseException as e:
    res["run_error"] = "%s: %s" % (type(e).__name__, e)

# Tool functions are what the agent calls at run time; invoking one must not run
# text taken from the definition either.
call_errors = []
for name, value in list(g.items()):
    if not name.startswith("invoke_") or name == "invoke_agent":
        continue
    if not callable(value):
        continue
    try:
        value("query", {})
    except TypeError:
        try:
            value("query")
        except BaseException as e:
            call_errors.append("%s: %s: %s" % (name, type(e).__name__, e))
    except BaseException as e:
        call_errors.append("%s: %s: %s" % (name, type(e).__name__, e))
if call_errors:
    res["call_error"] = " | ".join(call_errors)

for key, value in list(g.items()):
    if key.startswith("__"):
        continue
    if isinstance(value, str):
        res["strings"][key] = value
    elif isinstance(value, list) and all(isinstance(x, str) for x in value):
        res["lists"][key] = value
    elif inspect.isfunction(value):
        try:
            res["signatures"][key] = str(inspect.signature(value))
        except Exception:
            pass
        if value.__doc__:
            res["docs"][key] = value.__doc__

open(out_path, "w").write(json.dumps(res))
`;

export interface RunResult {
  syntax_error: string | null;
  run_error: string | null;
  call_error: string | null;
  docs: Record<string, string>;
  strings: Record<string, string>;
  lists: Record<string, string[]>;
  signatures: Record<string, string>;
}

/** Execute one generated agent project under the framework stubs. */
export function runGenerated(outcome: ImportOutcome): RunResult {
  const work = mkdtempSync(join(tmpdir(), 'agentcore-run-'));
  try {
    const agentDir = join(work, 'agent');
    mkdirSync(agentDir);
    for (const [name, content] of Object.entries(outcome.files)) {
      writeFileSync(join(agentDir, name), content, 'utf-8');
    }
    for (const [rel, content] of Object.entries(STUBS)) {
      const target = join(work, rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, 'utf-8');
    }
    const outPath = join(work, 'result.json');
    const runner = join(work, 'runner.py');
    writeFileSync(runner, RUNNER, 'utf-8');
    execFileSync('python3', [runner, agentDir, outPath], {
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin', PYTHONPATH: join(work, 'stubs'), PYTHONDONTWRITEBYTECODE: '1' },
      stdio: 'pipe',
      timeout: 60000,
    });
    return JSON.parse(readFileSync(outPath, 'utf-8')) as RunResult;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Every string the generated project exposes, including list elements. */
export function allStrings(run: RunResult): string[] {
  return [...Object.values(run.strings), ...Object.values(run.docs), ...Object.values(run.lists).flat()];
}
