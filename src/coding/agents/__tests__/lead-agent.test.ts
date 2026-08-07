import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Model, type ModelProvider } from "@/foundation";

import { createCodingAgent } from "../lead-agent";

const provider: ModelProvider = {
  async invoke() {
    return { role: "assistant", content: [{ type: "text", text: "done" }] };
  },
  async *stream() {
    yield { role: "assistant", content: [{ type: "text", text: "done" }] };
  },
};

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test("uses the supplied cwd for the default .agents/skills directory", async () => {
  const projectDir = await mkdtemp(join(tmpdir(), "helixent-coding-agent-"));
  temporaryRoots.push(projectDir);
  const skillDir = join(projectDir, ".agents", "skills", "cwd-skill");
  const skillPath = join(skillDir, "SKILL.md");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    skillPath,
    ["---", "name: cwd-skill", "description: Loaded from explicit cwd", "---", "Body", ""].join("\n"),
    "utf8",
  );

  const agent = await createCodingAgent({
    model: new Model("test-model", provider),
    cwd: projectDir,
  });

  const skillsMiddleware = agent.middlewares[0]!;
  const result = await skillsMiddleware.beforeAgentRun?.({
    agentContext: { prompt: agent.prompt, messages: agent.messages, tools: agent.tools },
  });

  expect(result?.skills).toHaveLength(1);
  expect(result?.skills?.[0]).toMatchObject({
    name: "cwd-skill",
    path: skillPath,
  });
});
