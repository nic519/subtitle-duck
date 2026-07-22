export type UiPlatform = "windows" | "macos" | "linux" | "other";

export function detectUiPlatform(
  userAgentDataPlatform?: string,
  navigatorPlatform?: string
): UiPlatform {
  const source = (userAgentDataPlatform ?? navigatorPlatform ?? "").toLowerCase();

  if (source.includes("win")) {
    return "windows";
  }

  if (source.includes("mac")) {
    return "macos";
  }

  if (source.includes("linux")) {
    return "linux";
  }

  return "other";
}
