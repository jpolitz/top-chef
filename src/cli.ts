import { createInterface } from "readline/promises";
import { stdin, stdout, argv } from "process";
import { resolve } from "path";
import { marked, MarkedExtension } from "marked";
import { markedTerminal } from "marked-terminal";
import { AnthropicProvider } from "./provider/anthropic.js";
import { buildSystemPrompt, PromptConfig } from "./prompts.js";
import { TOOLS, createToolExecutor } from "./tools.js";
import { runAgent, ToolCallback } from "./agent.js";
import { Message } from "./provider/types.js";

marked.use(markedTerminal() as MarkedExtension);

function parseArgs(): {
  config: PromptConfig;
  verbose: boolean;
  model: string;
  workspace: string;
} {
  const args = argv.slice(2);
  let steps = "htdc-java";
  let strategy = "guided";
  let verbose = false;
  let model = "claude-sonnet-4-6";
  let workspace = ".";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--steps":
        steps = args[++i];
        break;
      case "--strategy":
        strategy = args[++i];
        break;
      case "--model":
        model = args[++i];
        break;
      case "--workspace":
        workspace = args[++i];
        break;
      case "--verbose":
        verbose = true;
        break;
      case "--help":
        console.log(`Usage: chief-cook [options]

Options:
  --steps <name>        DR steps definition (default: htdc-java)
  --strategy <name>     Tutoring strategy (default: guided)
  --model <model>       LLM model (default: claude-sonnet-4-6)
  --workspace <path>    Student workspace directory (default: .)
  --verbose             Show tool calls and results
  --help                Show this help`);
        process.exit(0);
    }
  }

  return {
    config: { steps, strategy },
    verbose,
    model,
    workspace: resolve(workspace),
  };
}

async function main() {
  const { config, verbose, model, workspace } = parseArgs();

  const provider = new AnthropicProvider(model);
  const system = await buildSystemPrompt(config);
  const executeTools = createToolExecutor(workspace);
  let messages: Message[] = [];

  const callbacks: ToolCallback = verbose
    ? {
        onToolUse(name, input) {
          console.log(`\n  [tool] ${name}(${JSON.stringify(input)})`);
        },
        onToolResult(name, result) {
          const preview =
            result.length > 200 ? result.slice(0, 200) + "..." : result;
          console.log(`  [result] ${name} → ${preview}`);
        },
      }
    : {};

  console.log(`chief-cook — Design Recipe tutor`);
  console.log(`  steps: ${config.steps} | strategy: ${config.strategy}`);
  console.log(`  workspace: ${workspace}`);
  console.log(`  model: ${model}${verbose ? " | verbose" : ""}`);
  console.log();

  // Startup turn: agent explores the workspace and greets the student
  messages.push({
    role: "user",
    content: "I just opened my workspace. What do we have to work on?",
  });

  const startup = await runAgent(
    provider,
    system,
    TOOLS,
    messages,
    executeTools,
    callbacks
  );
  messages = startup.messages;
  console.log(`tutor> ${marked.parse(startup.text)}`);

  // Conversation loop
  const rl = createInterface({ input: stdin, output: stdout });

  while (true) {
    let input: string;
    try {
      input = await rl.question("you> ");
    } catch {
      break;
    }

    if (!input.trim()) continue;
    if (input.trim().toLowerCase() === "quit") break;

    messages.push({ role: "user", content: input });

    try {
      const response = await runAgent(
        provider,
        system,
        TOOLS,
        messages,
        executeTools,
        callbacks
      );
      messages = response.messages;
      console.log(`\ntutor> ${marked.parse(response.text)}`);
    } catch (err: unknown) {
      console.error(
        `\nError: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }

  rl.close();
  console.log("Goodbye!");
}

main();
