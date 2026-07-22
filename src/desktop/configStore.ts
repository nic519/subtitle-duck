import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Utils } from "electrobun/bun";

type ConfigData = Record<string, string>;

const CONFIG_FILE = ".subtitle-duck-config.json";
const configPath = join(Utils.paths.userData, CONFIG_FILE);

const readJsonFile = async (path: string): Promise<ConfigData | null> => {
  try {
    const content = await readFile(path, "utf-8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "string")
    ) as ConfigData;
  } catch {
    return null;
  }
};

const loadConfig = async (): Promise<ConfigData> => {
  const current = await readJsonFile(configPath);
  if (current) return current;

  return {};
};

const saveConfig = async (data: ConfigData): Promise<void> => {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(data, null, 2), "utf-8");
};

export const configGet = async (key: string): Promise<string | null> => {
  const data = await loadConfig();
  return data[key] ?? null;
};

export const configSet = async (
  key: string,
  value: string | null
): Promise<string | null> => {
  const data = await loadConfig();

  if (value === null || value === "") {
    delete data[key];
    await saveConfig(data);
    return null;
  }

  data[key] = value;
  await saveConfig(data);
  return value;
};
