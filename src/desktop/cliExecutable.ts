import { existsSync as defaultExistsSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

const EXTRA_CLI_DIRECTORIES = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/opt/local/bin",
];

export const resolveCliExecutable = (
  executable: string,
  options: {
    envPath?: string;
    existsSync?: (filePath: string) => boolean;
  } = {}
): string => {
  if (executable.includes("/") || isAbsolute(executable)) return executable;

  const checkExists = options.existsSync ?? defaultExistsSync;
  const directories = [
    ...(options.envPath ?? process.env.PATH ?? "").split(delimiter),
    ...EXTRA_CLI_DIRECTORIES,
  ].filter(Boolean);

  const seen = new Set<string>();
  for (const directory of directories) {
    if (seen.has(directory)) continue;
    seen.add(directory);

    const candidate = join(directory, executable);
    if (checkExists(candidate)) return candidate;
  }

  return executable;
};
