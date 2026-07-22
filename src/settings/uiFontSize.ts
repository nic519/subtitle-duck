import type { UiPlatform } from "@/utils/platform";

export type UiFontSize = "standard" | "large" | "extra_large";

export const UI_FONT_SIZE_CONFIG_KEY = "ui_font_size";

export const UI_FONT_SIZE_LABELS: Record<UiFontSize, string> = {
  standard: "标准",
  large: "较大",
  extra_large: "特大",
};

export const UI_FONT_SIZE_OPTIONS: UiFontSize[] = [
  "standard",
  "large",
  "extra_large",
];

export const sanitizeUiFontSize = (
  value: string | null | undefined
): UiFontSize | null => {
  if (
    value === "standard" ||
    value === "large" ||
    value === "extra_large"
  ) {
    return value;
  }

  return null;
};

export const getDefaultUiFontSize = (platform: UiPlatform): UiFontSize =>
  platform === "windows" ? "large" : "standard";

export const getInitialUiFontSize = (
  platform: UiPlatform,
  storedValue?: string | null
): UiFontSize =>
  sanitizeUiFontSize(storedValue) ?? getDefaultUiFontSize(platform);
