import Anthropic from "@anthropic-ai/sdk";

export type Message = Anthropic.MessageParam;
export type Tool = Anthropic.Tool;
export type ContentBlock = Anthropic.ContentBlock;
export type ToolResultBlockParam = Anthropic.ToolResultBlockParam;

export interface LLMResponse {
  stopReason: string;
  content: ContentBlock[];
}

export interface LLMProvider {
  send(
    system: string,
    tools: Tool[],
    messages: Message[]
  ): Promise<LLMResponse>;
}
