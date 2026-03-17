import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "..", "prompts");

async function readPrompt(name: string): Promise<string> {
  const path = join(PROMPTS_DIR, `${name}.txt`);
  return await readFile(path, "utf-8");
}

export interface PromptConfig {
  /** Which DR steps definition to use, e.g. "htdc-java" */
  steps: string;
  /** Which tutoring strategy to use, e.g. "guided" */
  strategy: string;
}

export async function buildSystemPrompt(config: PromptConfig): Promise<string> {
  const parts = await Promise.all([
    readPrompt("role"),
    readPrompt("tools"),
    readPrompt("guardrails"),
    readPrompt(`steps/${config.steps}`),
    readPrompt(`strategies/${config.strategy}`),
  ]);

  return parts.join("\n\n");
}
