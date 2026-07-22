import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LayoutElementProps = ComponentProps<"div"> & {
  [key: `data-${string}`]: string | number | boolean | undefined;
};

export const FixedRailLayout = ({
  rail,
  children,
  viewportClassName,
  gridClassName,
  railClassName,
  contentClassName,
  gridProps,
  railProps,
  contentProps,
}: {
  rail: ReactNode;
  children: ReactNode;
  viewportClassName?: string;
  gridClassName?: string;
  railClassName?: string;
  contentClassName?: string;
  gridProps?: LayoutElementProps;
  railProps?: LayoutElementProps;
  contentProps?: LayoutElementProps;
}) => (
  <div
    data-fixed-rail-layout="true"
    className={cn("min-h-0 flex-1 overflow-hidden", viewportClassName)}
  >
    <div
      {...gridProps}
      data-fixed-rail-grid="true"
      className={cn(
        "mx-auto grid h-full min-h-0 w-full grid-cols-1 gap-4",
        gridProps?.className,
        gridClassName,
      )}
    >
      <div
        {...railProps}
        data-fixed-rail-slot="rail"
        className={cn(
          "min-w-0 overflow-x-auto md:overflow-x-hidden",
          railProps?.className,
          railClassName,
        )}
      >
        {rail}
      </div>
      <div
        {...contentProps}
        data-fixed-rail-slot="content"
        className={cn(
          "custom-scrollbar min-w-0 overflow-y-auto overflow-x-hidden",
          contentProps?.className,
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  </div>
);

type ToolbarButtonProps = ComponentProps<typeof Button> & {
  darkMode?: boolean;
};

const toolbarButtonClassName =
  "h-[var(--control-height-md)] rounded-[var(--control-radius-sm)] border border-transparent bg-[var(--control-fill)] px-2.5 text-[length:var(--font-size-control)] leading-[var(--line-height-control)] text-[var(--text-primary)] shadow-none hover:bg-[var(--control-fill-hover)]";

export const ToolbarButton = ({
  darkMode: _darkMode,
  className,
  ...props
}: ToolbarButtonProps) => (
  <Button className={cn(toolbarButtonClassName, className)} {...props} />
);

export const ToolbarIconButton = ({
  darkMode: _darkMode,
  className,
  ...props
}: ToolbarButtonProps) => (
  <Button
    className={cn(toolbarButtonClassName, "w-8 px-0", className)}
    {...props}
  />
);

type StatusMessageTone = "neutral" | "success" | "warning" | "error" | "info";

const statusClassNames: Record<StatusMessageTone, string> = {
  neutral:
    "border-transparent bg-[var(--result-chip)] text-muted-foreground",
  success:
    "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  warning:
    "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  error:
    "border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-text)]",
  info: "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
};

export const StatusMessage = ({
  tone = "neutral",
  darkMode: _darkMode,
  className,
  children,
}: {
  tone?: StatusMessageTone;
  darkMode?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <div
    className={cn(
      "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)]",
      statusClassNames[tone],
      className,
    )}
  >
    {children}
  </div>
);
