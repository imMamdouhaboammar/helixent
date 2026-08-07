import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";

import { appendToolToAllowList, settingsSchema } from "./settings";
import { SettingsLoader } from "./settings-loader";

export class SettingsWriter {
  private readonly loader: SettingsLoader;

  constructor(loader: SettingsLoader = new SettingsLoader()) {
    this.loader = loader;
  }

  async appendAllowedTool(cwd: string, toolName: string): Promise<void> {
    const cwdStat = await stat(cwd).catch(() => null);
    if (!cwdStat?.isDirectory()) {
      throw new Error(`Project cwd must exist and be a directory: ${cwd}`);
    }

    const path = this.loader.projectLocalSettingsPath(cwd);
    const file = Bun.file(path);
    let base: Record<string, unknown> = {};
    if (await file.exists()) {
      try {
        const data: unknown = await file.json();
        const parsed = settingsSchema.safeParse(data);
        if (parsed.success) {
          base = parsed.data as Record<string, unknown>;
        } else if (typeof data === "object" && data !== null && !Array.isArray(data)) {
          console.warn("[helixent] Merging into settings.local.json with relaxed parse; fixing shape on write.");
          base = data as Record<string, unknown>;
        }
      } catch {
        console.warn(`[helixent] Could not parse ${path}; overwriting with new permissions.`);
        base = {};
      }
    }
    const merged = appendToolToAllowList(base, toolName);
    const out = JSON.stringify(merged, null, 2) + "\n";
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, out);
  }
}
