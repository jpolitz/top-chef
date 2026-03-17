import { readFile, writeFile, readdir } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { basename, join, resolve } from "path";
import { ContentBlock, Tool, ToolResultBlockParam } from "./provider/types.js";

const execFileAsync = promisify(execFile);

// --- Tool definitions sent to Claude ---

export const TOOLS: Tool[] = [
  {
    name: "list_files",
    description:
      "List files and directories in the given path, relative to the workspace root. Returns names with a trailing / for directories.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "Directory path relative to workspace root (default: workspace root)",
        },
      },
      required: [],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file, relative to the workspace root",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to workspace root",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write content to a file (relative to workspace root), creating it if it does not exist",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to workspace root",
        },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_java",
    description:
      "Compile and run a Java file (relative to workspace root). Returns compiler errors or program output.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the .java file relative to workspace root",
        },
      },
      required: ["path"],
    },
  },
];

// --- Tool execution ---

interface ToolInput {
  path?: string;
  content?: string;
}

export function createToolExecutor(workspace: string) {
  /** Resolve a path relative to the workspace, preventing escapes */
  function resolvePath(relative: string): string {
    const resolved = resolve(workspace, relative);
    if (!resolved.startsWith(resolve(workspace))) {
      throw new Error("Path is outside the workspace");
    }
    return resolved;
  }

  return async function executeTools(
    content: ContentBlock[]
  ): Promise<ToolResultBlockParam[]> {
    const results: ToolResultBlockParam[] = [];

    for (const block of content) {
      if (block.type !== "tool_use") continue;

      const input = block.input as ToolInput;
      let result: string;

      try {
        switch (block.name) {
          case "list_files":
            result = await handleListFiles(resolvePath(input.path ?? "."));
            break;
          case "read_file":
            result = await handleReadFile(resolvePath(input.path!));
            break;
          case "write_file":
            result = await handleWriteFile(
              resolvePath(input.path!),
              input.content!
            );
            break;
          case "run_java":
            result = await handleRunJava(resolvePath(input.path!));
            break;
          default:
            result = `Unknown tool: ${block.name}`;
        }
      } catch (err: unknown) {
        result = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }

      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    return results;
  };
}

async function handleListFiles(absPath: string): Promise<string> {
  const entries = await readdir(absPath, { withFileTypes: true });
  const lines = entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  return lines.length > 0 ? lines.join("\n") : "(empty directory)";
}

async function handleReadFile(absPath: string): Promise<string> {
  return await readFile(absPath, "utf-8");
}

async function handleWriteFile(
  absPath: string,
  content: string
): Promise<string> {
  await writeFile(absPath, content, "utf-8");
  return "File written successfully.";
}

async function handleRunJava(absPath: string): Promise<string> {
  const dir = join(absPath, "..");
  const file = basename(absPath);
  const className = file.replace(/\.java$/, "");

  // Compile
  try {
    await execFileAsync("javac", [file], { cwd: dir, timeout: 10000 });
  } catch (err: any) {
    return `Compilation failed:\n${err.stderr || err.message}`;
  }

  // Run
  try {
    const { stdout, stderr } = await execFileAsync("java", [className], {
      cwd: dir,
      timeout: 5000,
    });
    let output = stdout;
    if (stderr) output += `\nStderr:\n${stderr}`;
    return output || "(no output)";
  } catch (err: any) {
    return `Runtime error:\n${err.stderr || err.message}`;
  }
}
