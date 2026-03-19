# Chief Cook — Development Guide

## What is this?

A Design Recipe tutoring agent for UCSD CSE11 (How to Design Classes). Currently a CLI prototype; will become a VS Code extension with a backend server.

## Project structure

- `src/` — TypeScript source
  - `cli.ts` — Interactive CLI entry point
  - `agent.ts` — Provider-agnostic agentic tool-use loop
  - `tools.ts` — Tool definitions (JSON schemas) and local execution (filesystem, javac)
  - `prompts.ts` — Composable prompt assembly from text files
  - `provider/types.ts` — Abstract LLM provider interface (all Anthropic SDK type aliases live here)
  - `provider/anthropic.ts` — Anthropic implementation
- `prompts/` — Composable prompt text files (role, tools, guardrails, steps, strategies)
- `test-workspace/` — Sample student workspace for manual testing
- `examples/` — Example assignment files

## Key architectural decisions

- **Provider abstraction**: Only `provider/types.ts` and `provider/anthropic.ts` import `@anthropic-ai/sdk`. Everything else uses the type aliases from `types.ts`. Keep it this way.
- **Composable prompts**: The system prompt is assembled from separate text files in `prompts/`. This supports experimenting with different tutoring strategies, DR step definitions, etc. Assignments are NOT part of the system prompt — the agent discovers them by exploring the workspace at startup.
- **Tool execution is client-side**: Tools (read_file, write_file, list_files, run_java) run on the student's machine, not on a server. The backend (when built) will only proxy LLM requests.
- **Workspace scoping**: All tool paths resolve relative to a workspace root. The `createToolExecutor(workspace)` factory enforces this.

## Commands

```bash
npm start                                        # run CLI (defaults)
npm start -- --workspace path/to/dir             # point at a student workspace
npm start -- --strategy strict --verbose         # strict DR enforcement, show tool calls
npm run typecheck                                # tsc --noEmit
npm run build                                    # compile to dist/
```

## When editing prompts

- Prompt files are plain text in `prompts/`. Edit them directly.
- `role.txt` — stable tutor identity and startup behavior
- `tools.txt` — how the agent should use its tools
- `guardrails.txt` — what the agent must never do
- `steps/<name>.txt` — Design Recipe step definitions (can have multiple versions)
- `strategies/<name>.txt` — tutoring approach variations (guided, strict, etc.)
- `assignments/` — reference examples, not loaded into prompts

## Style

- TypeScript with strict mode
- ES modules (`"type": "module"` in package.json, `.js` extensions in imports)
- Prefer small, focused files. The agent loop, tool execution, and prompt assembly are deliberately separate.
