import {
  LLMProvider,
  Message,
  Tool,
  ContentBlock,
  ToolResultBlockParam,
} from "./provider/types.js";

export type ToolExecutor = (
  content: ContentBlock[]
) => Promise<ToolResultBlockParam[]>;

const MAX_TOOL_ROUNDS = 10;

export interface AgentResponse {
  /** The final text to show the student */
  text: string;
  /** Updated conversation history (caller should keep this for the next turn) */
  messages: Message[];
}

export interface ToolCallback {
  /** Called when the agent uses a tool, before execution. Return value is ignored. */
  onToolUse?(name: string, input: Record<string, unknown>): void;
  /** Called after a tool executes, with the result string. */
  onToolResult?(name: string, result: string): void;
}

export async function runAgent(
  provider: LLMProvider,
  system: string,
  tools: Tool[],
  messages: Message[],
  executeTools: ToolExecutor,
  callbacks?: ToolCallback
): Promise<AgentResponse> {
  // Copy so we don't mutate the caller's array
  messages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await provider.send(system, tools, messages);

    messages.push({ role: "assistant", content: response.content });

    if (response.stopReason === "end_turn") {
      const text = extractText(response.content);
      return { text, messages };
    }

    // Notify callbacks about tool use
    if (callbacks) {
      for (const block of response.content) {
        if (block.type === "tool_use") {
          callbacks.onToolUse?.(block.name, block.input as Record<string, unknown>);
        }
      }
    }

    const toolResults = await executeTools(response.content);

    // Notify callbacks about tool results
    if (callbacks) {
      for (const result of toolResults) {
        const block = response.content.find(
          (b) => b.type === "tool_use" && b.id === result.tool_use_id
        );
        const name = block?.type === "tool_use" ? block.name : "unknown";
        const text = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
        callbacks.onToolResult?.(name, text);
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  // Hit max rounds — return whatever text we have
  const lastAssistant = messages
    .filter((m) => m.role === "assistant")
    .pop();
  const text = lastAssistant
    ? extractText(lastAssistant.content as ContentBlock[])
    : "(Agent reached maximum tool rounds without a final response.)";

  return { text, messages };
}

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
