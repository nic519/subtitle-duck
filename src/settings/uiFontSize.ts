import type { UiPlatform } from "@/utils/platform";

export type UiFontSize = "standard" | "large" | "extra_large";

export const UI_FONT_SIZE_CONFIG_KEY = "ui_font_size";

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
