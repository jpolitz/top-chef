import Anthropic from "@anthropic-ai/sdk";
import { LLMProvider, LLMResponse, Message, Tool } from "./types.js";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(model = "claude-sonnet-4-6") {
    this.client = new Anthropic();
    this.model = model;
  }

  async send(
    system: string,
    tools: Tool[],
    messages: Message[]
  ): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      tools,
      messages,
    });

    return {
      stopReason: response.stop_reason ?? "end_turn",
      content: response.content,
    };
  }
}
