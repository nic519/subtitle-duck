export type AppleButtonTone = "primary" | "secondary";
export type AppleStatusTone = "success" | "warning" | "error" | "info";

const SURFACE_CLASS_NAMES = {
  light: "bg-[var(--surface-base)]",
  dark: "bg-[var(--surface-base)]",
} as const;

const BUTTON_CLASS_NAMES: Record<
  AppleButtonTone,
  { light: string; dark: string }
> = {
  primary: {
    light: "bg-[var(--control-accent)] text-[var(--control-accent-foreground)]",
    dark: "bg-[var(--control-accent)] text-[var(--control-accent-foreground)]",
  },
  secondary: {
    light:
      "bg-[var(--control-fill)] text-[var(--text-primary)] hover:bg-[var(--control-fill-hover)]",
    dark:
      "bg-[var(--control-fill)] text-[var(--text-primary)] hover:bg-[var(--control-fill-hover)]",
  },
};

const STATUS_TONE_CLASS_NAMES: Record<
  AppleStatusTone,
  { light: string; dark: string }
> = {
  success: {
    light: "text-[var(--status-success-text)]",
    dark: "text-[var(--status-success-text)]",
  },
  warning: {
    light: "text-[var(--status-warning-text)]",
    dark: "text-[var(--status-warning-text)]",
  },
  error: {
    light: "text-[var(--status-error-text)]",
    dark: "text-[var(--status-error-text)]",
  },
  info: {
    light: "text-[var(--status-info-text)]",
    dark: "text-[var(--status-info-text)]",
  },
};

const TITLE_CLASS_NAMES = {
  light:
    "text-[length:var(--font-size-title)] font-medium tracking-normal leading-[var(--line-height-title)] text-[var(--text-heading)]",
  dark:
    "text-[length:var(--font-size-title)] font-medium tracking-normal leading-[var(--line-height-title)] text-[var(--text-heading)]",
} as const;

const WINDOW_CONTROL_CLASS_NAMES = {
  light:
    "text-[var(--control-icon)] hover:bg-[var(--control-fill-hover)] hover:text-[var(--text-primary)]",
  dark:
    "text-[var(--control-icon)] hover:bg-[var(--control-fill-hover)] hover:text-[var(--text-primary)]",
} as const;

const CONTROL_ICON_BUTTON_CLASS_NAMES = {
  light:
    "size-[var(--control-size-sm)] rounded-[var(--control-radius-md)] text-[var(--control-icon)] hover:bg-[var(--control-fill-hover)] hover:text-[var(--text-primary)] aria-expanded:bg-[var(--control-fill-active)]",
  dark:
    "size-[var(--control-size-sm)] rounded-[var(--control-radius-md)] text-[var(--control-icon)] hover:bg-[var(--control-fill-hover)] hover:text-[var(--text-primary)] aria-expanded:bg-[var(--control-fill-active)]",
} as const;

const SEARCH_PANEL_CLASS_NAMES = {
  light:
    "border border-[var(--search-panel-border)] bg-[var(--search-panel-bg)] shadow-[var(--search-panel-shadow)]",
  dark:
    "border border-[var(--search-panel-border)] bg-[var(--search-panel-bg)] shadow-[var(--search-panel-shadow)]",
} as const;

const SEARCH_FIELD_SHELL_CLASS_NAMES = {
  light: "border-[var(--search-field-border)] bg-[var(--search-field-bg)]",
  dark: "border-[var(--search-field-border)] bg-[var(--search-field-bg)]",
} as const;

const SEARCH_FIELD_CLASS_NAMES = {
  light:
    "rounded-[12px] bg-transparent text-[var(--text-heading)] placeholder:text-[var(--search-placeholder)]",
  dark:
    "rounded-[12px] bg-transparent text-[var(--text-heading)] placeholder:text-[var(--search-placeholder)]",
} as const;

const LIST_ROW_CLASS_NAMES = {
  light:
    "border-[var(--list-row-border)] text-[var(--text-heading)] hover:bg-[var(--list-row-hover-bg)]",
  dark:
    "border-[var(--list-row-border)] text-[var(--text-heading)] hover:bg-[var(--list-row-hover-bg)]",
} as const;

const SUBTLE_TEXT_CLASS_NAMES = {
  light: "text-[var(--text-subtle)]",
  dark: "text-[var(--text-subtle)]",
} as const;

const SECONDARY_LABEL_CLASS_NAMES = {
  light: "text-[var(--text-secondary)]",
  dark: "text-[var(--text-secondary)]",
} as const;

const AUXILIARY_ACTION_CLASS_NAMES = {
  light:
    "bg-[var(--aux-action-bg)] text-[var(--aux-action-text)] hover:bg-[var(--aux-action-hover-bg)] hover:text-[var(--aux-action-hover-text)]",
  dark:
    "bg-[var(--aux-action-bg)] text-[var(--aux-action-text)] hover:bg-[var(--aux-action-hover-bg)] hover:text-[var(--aux-action-hover-text)]",
} as const;

const PROMINENT_TEXT_CLASS_NAMES = {
  light: "text-[var(--text-prominent)]",
  dark: "text-[var(--text-prominent)]",
} as const;

const SEARCH_SECTION_BORDER_CLASS_NAMES = {
  light: "border-[color:var(--result-divider)]",
  dark: "border-[color:var(--result-divider)]",
} as const;

const ROW_INDEX_CLASS_NAMES = {
  light: "bg-[var(--row-index-bg)] text-[var(--text-subtle)]",
  dark: "bg-[var(--row-index-bg)] text-[var(--text-subtle)]",
} as const;

const SETTINGS_PAGE_BACKGROUND_CLASS_NAMES = {
  light: "bg-[var(--settings-bg)]",
  dark: "bg-[var(--settings-bg)]",
} as const;

const PREFERENCE_SECTION_LABEL_CLASS_NAMES = {
  light:
    "px-1 text-[length:var(--font-size-caption)] font-semibold leading-[var(--line-height-caption)] text-[var(--preference-section-label)]",
  dark:
    "px-1 text-[length:var(--font-size-caption)] font-semibold leading-[var(--line-height-caption)] text-[var(--preference-section-label)]",
} as const;

const PREFERENCE_LIST_CLASS_NAMES = {
  light:
    "overflow-hidden rounded-[13px] border border-[var(--preference-list-border)] bg-[var(--preference-list-bg)] shadow-[0_18px_44px_-40px_rgba(0,0,0,0.45)]",
  dark:
    "overflow-hidden rounded-[13px] border border-[var(--preference-list-border)] bg-[var(--preference-list-bg)] shadow-[0_18px_44px_-38px_rgba(0,0,0,0.88)]",
} as const;

const PREFERENCE_ROW_CLASS_NAMES = {
  light:
    "grid min-h-[var(--preference-row-min-height)] grid-cols-[128px_minmax(0,1fr)] items-center gap-4 border-t border-[var(--preference-row-border)] px-4 py-2.5 first:border-t-0",
  dark:
    "grid min-h-[var(--preference-row-min-height)] grid-cols-[128px_minmax(0,1fr)] items-center gap-4 border-t border-[var(--preference-row-border)] px-4 py-2.5 first:border-t-0",
} as const;

const PREFERENCE_INLINE_STATUS_CLASS_NAMES: Record<
  AppleStatusTone,
  { light: string; dark: string }
> = {
  success: {
    light:
      "text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--status-success-strong-text)]",
    dark:
      "text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--status-success-strong-text)]",
  },
  warning: {
    light:
      "text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--status-warning-strong-text)]",
    dark:
      "text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--status-warning-strong-text)]",
  },
  error: {
    light:
      "text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--status-error-strong-text)]",
    dark:
      "text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--status-error-strong-text)]",
  },
  info: {
    light:
      "text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--status-info-strong-text)]",
    dark:
      "text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-[var(--status-info-strong-text)]",
  },
};

const FORM_FIELD_CLASS_NAMES = {
  light:
    "h-[var(--control-height-sm)] w-full rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2.5 text-[length:var(--font-size-control)] leading-[var(--line-height-control)] text-[var(--text-primary)] shadow-none outline-none transition-[border-color,background-color,box-shadow] placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus:bg-[var(--form-field-focus-bg)] focus:shadow-[0_0_0_3px_var(--control-fill-active)]",
  dark:
    "h-[var(--control-height-sm)] w-full rounded-[var(--control-radius-sm)] border border-[var(--form-field-border)] bg-[var(--form-field-bg)] px-2.5 text-[length:var(--font-size-control)] leading-[var(--line-height-control)] text-[var(--text-primary)] shadow-none outline-none transition-[border-color,background-color,box-shadow] placeholder:text-[var(--form-field-placeholder)] focus:border-[var(--control-accent)] focus:bg-[var(--form-field-focus-bg)] focus:shadow-[0_0_0_3px_var(--control-fill-active)]",
} as const;

const SEGMENTED_CONTROL_CLASS_NAMES = {
  light:
    "inline-flex !rounded-[10px] data-[size=sm]:!rounded-[10px] border border-[var(--control-border)] bg-[var(--control-fill)] p-0.5 shadow-inner shadow-black/5",
  dark:
    "inline-flex !rounded-[10px] data-[size=sm]:!rounded-[10px] border border-[var(--control-border)] bg-[var(--control-fill)] p-0.5 shadow-inner shadow-black/20",
} as const;

const SEGMENTED_OPTION_CLASS_NAMES = {
  active: {
    light:
      "bg-[var(--control-accent)] text-[var(--control-accent-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.12)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--control-accent)]",
    dark:
      "bg-[var(--control-accent)] text-[var(--control-accent-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.28)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--control-accent)]",
  },
  inactive: {
    light:
      "text-[var(--segmented-option-text)] hover:bg-[var(--control-fill-hover)] hover:text-[var(--text-primary)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--control-accent)]",
    dark:
      "text-[var(--segmented-option-text)] hover:bg-[var(--control-fill-hover)] hover:text-[var(--text-primary)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--control-accent)]",
  },
} as const;

const SEGMENTED_OPTION_BASE_CLASS_NAMES =
  "min-w-[58px] rounded-[var(--control-radius-md)] border-0 px-2 text-[length:var(--font-size-control)] leading-[var(--line-height-control)] data-[state=on]:bg-[var(--control-accent)] data-[state=on]:text-[var(--control-accent-foreground)] data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,0.14)]";

const SWITCH_CLASS_NAMES =
  "border border-[var(--interactive-border)] data-[state=checked]:border-[var(--interactive-primary)] data-[state=checked]:bg-[var(--interactive-primary)] data-[state=unchecked]:bg-[var(--interactive-surface)]";

const STATUS_MESSAGE_CLASS_NAMES: Record<
  AppleStatusTone,
  { light: string; dark: string }
> = {
  success: {
    light:
      "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
    dark:
      "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  },
  warning: {
    light:
      "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
    dark:
      "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  },
  error: {
    light:
      "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]",
    dark:
      "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]",
  },
  info: {
    light:
      "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
    dark:
      "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  },
};

export function getSurfaceClassName(isDarkMode: boolean): string {
  return isDarkMode ? SURFACE_CLASS_NAMES.dark : SURFACE_CLASS_NAMES.light;
}

export function getButtonClassName(
  isDarkMode: boolean,
  tone: AppleButtonTone
): string {
  return isDarkMode
    ? BUTTON_CLASS_NAMES[tone].dark
    : BUTTON_CLASS_NAMES[tone].light;
}

export function getStatusToneClassName(
  isDarkMode: boolean,
  tone: AppleStatusTone
): string {
  return isDarkMode
    ? STATUS_TONE_CLASS_NAMES[tone].dark
    : STATUS_TONE_CLASS_NAMES[tone].light;
}

export function getTitleClassName(isDarkMode: boolean): string {
  return isDarkMode ? TITLE_CLASS_NAMES.dark : TITLE_CLASS_NAMES.light;
}

export function getWindowControlClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? WINDOW_CONTROL_CLASS_NAMES.dark
    : WINDOW_CONTROL_CLASS_NAMES.light;
}

export function getControlIconButtonClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? CONTROL_ICON_BUTTON_CLASS_NAMES.dark
    : CONTROL_ICON_BUTTON_CLASS_NAMES.light;
}

export function getSearchPanelClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? SEARCH_PANEL_CLASS_NAMES.dark
    : SEARCH_PANEL_CLASS_NAMES.light;
}

export function getSearchFieldShellClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? SEARCH_FIELD_SHELL_CLASS_NAMES.dark
    : SEARCH_FIELD_SHELL_CLASS_NAMES.light;
}

export function getSearchFieldClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? SEARCH_FIELD_CLASS_NAMES.dark
    : SEARCH_FIELD_CLASS_NAMES.light;
}

export function getListRowClassName(isDarkMode: boolean): string {
  return isDarkMode ? LIST_ROW_CLASS_NAMES.dark : LIST_ROW_CLASS_NAMES.light;
}

export function getSubtleTextClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? SUBTLE_TEXT_CLASS_NAMES.dark
    : SUBTLE_TEXT_CLASS_NAMES.light;
}

export function getSecondaryLabelClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? SECONDARY_LABEL_CLASS_NAMES.dark
    : SECONDARY_LABEL_CLASS_NAMES.light;
}

export function getAuxiliaryActionClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? AUXILIARY_ACTION_CLASS_NAMES.dark
    : AUXILIARY_ACTION_CLASS_NAMES.light;
}

export function getProminentTextClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? PROMINENT_TEXT_CLASS_NAMES.dark
    : PROMINENT_TEXT_CLASS_NAMES.light;
}

export function getSearchSectionBorderClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? SEARCH_SECTION_BORDER_CLASS_NAMES.dark
    : SEARCH_SECTION_BORDER_CLASS_NAMES.light;
}

export function getRowIndexClassName(isDarkMode: boolean): string {
  return isDarkMode ? ROW_INDEX_CLASS_NAMES.dark : ROW_INDEX_CLASS_NAMES.light;
}

export function getSettingsPageBackgroundClassName(
  isDarkMode: boolean
): string {
  return isDarkMode
    ? SETTINGS_PAGE_BACKGROUND_CLASS_NAMES.dark
    : SETTINGS_PAGE_BACKGROUND_CLASS_NAMES.light;
}

export function getPreferenceSectionLabelClassName(
  isDarkMode: boolean
): string {
  return isDarkMode
    ? PREFERENCE_SECTION_LABEL_CLASS_NAMES.dark
    : PREFERENCE_SECTION_LABEL_CLASS_NAMES.light;
}

export function getPreferenceListClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? PREFERENCE_LIST_CLASS_NAMES.dark
    : PREFERENCE_LIST_CLASS_NAMES.light;
}

export function getPreferenceRowClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? PREFERENCE_ROW_CLASS_NAMES.dark
    : PREFERENCE_ROW_CLASS_NAMES.light;
}

export function getPreferenceInlineStatusClassName(
  isDarkMode: boolean,
  tone: AppleStatusTone
): string {
  return isDarkMode
    ? PREFERENCE_INLINE_STATUS_CLASS_NAMES[tone].dark
    : PREFERENCE_INLINE_STATUS_CLASS_NAMES[tone].light;
}

export function getFormFieldClassName(isDarkMode: boolean): string {
  return isDarkMode ? FORM_FIELD_CLASS_NAMES.dark : FORM_FIELD_CLASS_NAMES.light;
}

export function getSegmentedControlClassName(isDarkMode: boolean): string {
  return isDarkMode
    ? SEGMENTED_CONTROL_CLASS_NAMES.dark
    : SEGMENTED_CONTROL_CLASS_NAMES.light;
}

export function getSegmentedOptionClassName(
  isDarkMode: boolean,
  isActive: boolean
): string {
  if (isActive) {
    return isDarkMode
      ? SEGMENTED_OPTION_CLASS_NAMES.active.dark
      : SEGMENTED_OPTION_CLASS_NAMES.active.light;
  }

  return isDarkMode
    ? SEGMENTED_OPTION_CLASS_NAMES.inactive.dark
    : SEGMENTED_OPTION_CLASS_NAMES.inactive.light;
}

export function getSegmentedOptionBaseClassName(): string {
  return SEGMENTED_OPTION_BASE_CLASS_NAMES;
}

export function getSwitchClassName(): string {
  return SWITCH_CLASS_NAMES;
}

export function getStatusMessageClassName(
  isDarkMode: boolean,
  tone: AppleStatusTone
): string {
  return isDarkMode
    ? STATUS_MESSAGE_CLASS_NAMES[tone].dark
    : STATUS_MESSAGE_CLASS_NAMES[tone].light;
}
