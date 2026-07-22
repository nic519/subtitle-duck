import type { ComponentProps, ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getButtonClassName,
  getSegmentedControlClassName,
  getSegmentedOptionBaseClassName,
  getSegmentedOptionClassName,
  getStatusMessageClassName,
  type AppleStatusTone,
} from "@/theme/appleTheme";
import { Button } from "@/components/ui/button";

export const getToolbarButtonClassName = (darkMode: boolean): string =>
  `${getButtonClassName(darkMode, "secondary")} h-[var(--control-height-md)] rounded-[var(--control-radius-sm)] border border-transparent px-2.5 text-[length:var(--font-size-control)] leading-[var(--line-height-control)] shadow-none`;

export const getToolbarIconButtonClassName = (darkMode: boolean): string =>
  `${getToolbarButtonClassName(darkMode)} w-8 px-0`;

/** Shared compact control for actions placed in the window title bar. */
export const getTitleBarActionButtonClassName = (darkMode: boolean): string =>
  `${getButtonClassName(darkMode, "secondary")} h-[var(--control-height-sm)] rounded-[var(--control-radius-sm)] border border-transparent px-2 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] shadow-none`;

const getFixedRailViewportClassName = (className?: string): string =>
  cn("min-h-0 flex-1 overflow-hidden", className);

const getFixedRailGridClassName = (className?: string): string =>
  cn("mx-auto grid h-full min-h-0 w-full grid-cols-1 gap-4", className);

const getFixedRailRailClassName = (className?: string): string =>
  cn("min-h-0 overflow-x-auto md:overflow-x-hidden", className);

const getFixedRailContentClassName = (className?: string): string =>
  cn("custom-scrollbar min-h-0 overflow-y-auto overflow-x-hidden", className);

type FixedRailDataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined;
};

type FixedRailLayoutSlotProps = FixedRailDataAttributes & {
  className?: string;
  children: ReactNode;
};

type FixedRailLayoutElementProps = ComponentProps<"div"> &
  FixedRailDataAttributes;

type FixedRailLayoutProps = FixedRailLayoutElementProps & {
  rail: ReactNode;
  children: ReactNode;
  viewportClassName?: string;
  gridClassName?: string;
  railClassName?: string;
  contentClassName?: string;
  gridProps?: FixedRailLayoutElementProps;
  railProps?: FixedRailLayoutElementProps;
  contentProps?: FixedRailLayoutElementProps;
  renderViewport?: (props: FixedRailLayoutSlotProps) => ReactNode;
  renderGrid?: (props: FixedRailLayoutSlotProps) => ReactNode;
};

export const FixedRailLayout = ({
  rail,
  children,
  className,
  viewportClassName,
  gridClassName,
  railClassName,
  contentClassName,
  gridProps,
  railProps,
  contentProps,
  renderViewport,
  renderGrid,
  ...props
}: FixedRailLayoutProps) => {
  const railNode = (
    <div
      {...railProps}
      data-fixed-rail-slot="rail"
      className={cn(
        getFixedRailRailClassName("min-w-0"),
        railProps?.className,
        railClassName
      )}
    >
      {rail}
    </div>
  );

  const contentNode = (
    <div
      {...contentProps}
      data-fixed-rail-slot="content"
      className={cn(
        getFixedRailContentClassName("min-w-0"),
        contentProps?.className,
        contentClassName
      )}
    >
      {children}
    </div>
  );

  const gridClassNameValue = cn(
    getFixedRailGridClassName(),
    gridProps?.className,
    gridClassName
  );
  const gridChildren = (
    <>
      {railNode}
      {contentNode}
    </>
  );
  const gridNodeProps = {
    ...(gridProps as FixedRailDataAttributes | undefined),
    "data-fixed-rail-grid": true,
    className: gridClassNameValue,
    children: gridChildren,
  };
  const gridNode = renderGrid ? (
    renderGrid(gridNodeProps)
  ) : (
    <div
      {...gridProps}
      data-fixed-rail-grid="true"
      className={gridClassNameValue}
    >
      {gridChildren}
    </div>
  );

  const viewportClassNameValue = cn(
    getFixedRailViewportClassName(),
    className,
    viewportClassName
  );
  const viewportNodeProps = {
    ...(props as FixedRailDataAttributes),
    "data-fixed-rail-layout": true,
    className: viewportClassNameValue,
    children: (
      <>
        {gridNode}
      </>
    ),
  };

  return renderViewport ? (
    <>{renderViewport(viewportNodeProps)}</>
  ) : (
    <div
      {...props}
      data-fixed-rail-layout="true"
      className={viewportClassNameValue}
    >
      {gridNode}
    </div>
  );
};

type ToolbarButtonProps = ComponentProps<typeof Button> & {
  darkMode?: boolean;
};

export const ToolbarButton = ({
  darkMode = false,
  variant = "secondary",
  size = "sm",
  className,
  ...props
}: ToolbarButtonProps) => (
  <Button
    variant={variant}
    size={size}
    className={cn(getToolbarButtonClassName(darkMode), className)}
    {...props}
  />
);

export const ToolbarIconButton = ({
  darkMode = false,
  variant = "secondary",
  size = "sm",
  className,
  ...props
}: ToolbarButtonProps) => (
  <Button
    variant={variant}
    size={size}
    className={cn(getToolbarIconButtonClassName(darkMode), className)}
    {...props}
  />
);

export const TitleBarActionButton = ({
  darkMode = false,
  variant = "secondary",
  size = "sm",
  className,
  ...props
}: ToolbarButtonProps) => (
  <Button
    variant={variant}
    size={size}
    className={cn(getTitleBarActionButtonClassName(darkMode), className)}
    {...props}
  />
);

export const IconActionButton = ({
  variant = "ghost",
  size = "toolbar",
  className,
  ...props
}: Omit<ToolbarButtonProps, "size"> & {
  size?: "compact" | "toolbar";
}) => (
  <Button
    variant={variant}
    size={size === "compact" ? "icon-xs" : "icon-sm"}
    className={cn(
      "rounded-[var(--control-radius-md)] hover:bg-[var(--control-fill-hover)]",
      className
    )}
    {...props}
  />
);

type SectionTabsOptionButtonProps = Omit<
  ComponentProps<"button">,
  | "aria-selected"
  | "children"
  | "disabled"
  | "onClick"
  | "role"
  | "type"
> & {
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
};

type SectionTabsOption<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
  buttonProps?: SectionTabsOptionButtonProps;
};

export const SectionTabs = <T extends string>({
  darkMode = false,
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  className,
  ...props
}: {
  darkMode?: boolean;
  value: T;
  options: Array<SectionTabsOption<T>>;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
} & Omit<
  ComponentProps<"div">,
  "children" | "role" | "aria-label" | "onChange"
>) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    {...props}
    className={cn(
      `${getSegmentedControlClassName(darkMode)} h-[var(--control-height-md)] min-w-0 shrink-0 items-center`,
      className
    )}
  >
    {options.map((option) => {
      const isSelected = option.id === value;
      const { className: optionClassName, ...optionButtonProps } =
        option.buttonProps ?? {};
      return (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={isSelected}
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
          {...optionButtonProps}
          className={cn(
            getSegmentedOptionBaseClassName(),
            "flex h-[var(--control-height-sm)] min-w-[68px] items-center justify-center gap-1.5",
            getSegmentedOptionClassName(darkMode, isSelected),
            optionClassName
          )}
        >
          {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
          <span>{option.label}</span>
          {typeof option.count === "number" ? (
            <span
              className={cn(
                "tabular-nums",
                isSelected ? "text-current/90" : "text-muted-foreground"
              )}
            >
              {option.count}
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);

type RailTabsOptionButtonProps = Omit<
  ComponentProps<"button">,
  | "aria-selected"
  | "children"
  | "disabled"
  | "onClick"
  | "role"
  | "type"
> & {
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
};

type RailTabsOption<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  buttonProps?: RailTabsOptionButtonProps;
};

export const RailTabs = <T extends string>({
  darkMode: _darkMode = false,
  value,
  options,
  onChange,
  collapsed = false,
  "aria-label": ariaLabel,
  className,
  ...props
}: {
  darkMode?: boolean;
  value: T;
  options: Array<RailTabsOption<T>>;
  onChange: (value: T) => void;
  collapsed?: boolean;
  "aria-label": string;
  className?: string;
} & Omit<
  ComponentProps<"nav">,
  "children" | "role" | "aria-label" | "onChange"
>) => (
  <nav
    role="tablist"
    aria-label={ariaLabel}
    aria-orientation="vertical"
    data-fixed-rail-tabs="true"
    {...props}
    className={cn(
      "flex min-w-0 gap-1 overflow-x-auto md:flex-col md:overflow-visible",
      className
    )}
  >
    {options.map((option) => {
      const isSelected = option.id === value;
      const { className: optionClassName, ...optionButtonProps } =
        option.buttonProps ?? {};
      return (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={isSelected}
          aria-label={option.label}
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
          {...optionButtonProps}
          title={collapsed ? option.label : optionButtonProps.title}
          className={cn(
            "flex h-9 shrink-0 items-center gap-2 rounded-[7px] px-2.5 text-left text-[length:var(--font-size-control)] leading-[var(--line-height-control)] transition-colors focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[var(--control-accent)] md:w-full",
            collapsed && "justify-center px-0",
            isSelected
              ? "bg-[var(--control-fill-active)] text-foreground"
              : "text-muted-foreground hover:bg-[var(--result-row-hover)] hover:text-foreground",
            optionClassName
          )}
        >
          {option.icon ? <span className="shrink-0" aria-hidden="true">{option.icon}</span> : null}
          <span className={cn("truncate", collapsed && "sr-only")}>{option.label}</span>
        </button>
      );
    })}
  </nav>
);

type StatusMessageTone = AppleStatusTone | "neutral";

const NEUTRAL_STATUS_CLASS_NAME =
  "rounded-[10px] border px-2.5 py-1.5 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] border-transparent bg-[var(--result-chip)] text-muted-foreground";

export const StatusMessage = ({
  tone = "neutral",
  darkMode = false,
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
      tone === "neutral"
        ? NEUTRAL_STATUS_CLASS_NAME
        : getStatusMessageClassName(darkMode, tone),
      className
    )}
  >
    {children}
  </div>
);

export const InlineLoadingState = ({
  label,
  className,
  iconClassName,
}: {
  label: string;
  className?: string;
  iconClassName?: string;
}) => (
  <div
    className={cn(
      "flex items-center gap-2 text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] text-muted-foreground",
      className
    )}
  >
    <RefreshCw className={cn("size-3.5 animate-spin", iconClassName)} />
    <span>{label}</span>
  </div>
);

export const PageLoadingState = ({
  label,
  className,
  iconClassName,
  size = "default",
  surface = "plain",
}: {
  label: string;
  className?: string;
  iconClassName?: string;
  size?: "default" | "compact";
  surface?: "plain" | "panel";
}) => (
  <div
    className={cn(
      "flex items-center justify-center gap-2 px-4 text-center text-muted-foreground",
      size === "compact"
        ? "h-52 rounded-[8px] text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)]"
        : "h-full min-h-[220px] flex-col text-[length:var(--font-size-body)] leading-[var(--line-height-body)]",
      surface === "panel" && "rounded-[8px] bg-[var(--result-surface)]",
      className
    )}
  >
    <RefreshCw
      className={cn(
        size === "compact" ? "size-3.5 animate-spin" : "size-8 animate-spin",
        iconClassName
      )}
    />
    <span>{label}</span>
  </div>
);
