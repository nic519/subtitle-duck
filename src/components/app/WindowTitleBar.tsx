import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  FolderSearch,
  Grid2X2,
  Minus,
  Settings,
  X,
} from "lucide-react";
import {
  getControlIconButtonClassName,
  getTitleClassName,
} from "../../theme/appleTheme";

export const WINDOW_TITLE_BAR_RIGHT_CONTEXT_ID =
  "window-title-bar-right-context";

export const WindowTitleBarRightContextPortal = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById(WINDOW_TITLE_BAR_RIGHT_CONTEXT_ID));
  }, []);

  return container ? createPortal(children, container) : null;
};

type WindowTitleBarAction =
  | {
    type: "settings";
    label: string;
    onClick: () => void;
  }
  | {
    type: "library";
    label: string;
    onClick: () => void;
  }
  | {
    type: "browseLibrary";
    label: string;
    onClick: () => void;
  }
  | {
    type: "back";
    label: string;
    onClick: () => void;
  };

interface WindowTitleBarProps {
  title: string;
  darkMode: boolean;
  onMinimize: () => void;
  onClose: () => void;
  leftAction?: WindowTitleBarAction;
  secondaryLeftAction?: WindowTitleBarAction;
  tertiaryLeftAction?: WindowTitleBarAction;
  titleContent?: ReactNode;
  rightContext?: ReactNode;
}

export const WindowTitleBar = ({
  title,
  darkMode,
  onMinimize,
  onClose,
  leftAction,
  secondaryLeftAction,
  tertiaryLeftAction,
  titleContent,
  rightContext,
}: WindowTitleBarProps) => {
  const controlClassName = getControlIconButtonClassName(darkMode);
  const titleBarButtonClassName =
    "electrobun-webkit-app-region-no-drag flex items-center justify-center transition-all duration-150 [&_svg]:size-3.5";

  return (
    <div
      className="electrobun-webkit-app-region-drag flex items-center justify-between px-3.5 pb-1.5 pt-2.5 select-none"
    >
      <div
        data-window-title-bar-window-controls
        className="flex shrink-0 items-center gap-1.5"
      >
        <button
          type="button"
          onClick={onMinimize}
          className={`${titleBarButtonClassName} ${controlClassName}`}
          title="最小化"
        >
          <Minus />
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`${titleBarButtonClassName} ${controlClassName}`}
          title="关闭"
        >
          <X />
        </button>
      </div>
      <div
        data-window-title-bar-left-divider
        aria-hidden="true"
        className="mx-2 h-5 w-px shrink-0 rounded-full bg-white/30"
      />
      <div
        data-window-title-bar-content
        className="mx-3 flex min-w-0 flex-1 items-center gap-2"
      >
        {[leftAction, secondaryLeftAction, tertiaryLeftAction]
          .filter((action): action is WindowTitleBarAction => Boolean(action))
          .map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={`${titleBarButtonClassName} ${controlClassName}`}
              title={action.label}
              aria-label={action.label}
            >
              {action.type === "settings" ? <Settings /> : null}
              {action.type === "library" ? <FolderSearch /> : null}
              {action.type === "browseLibrary" ? <Grid2X2 /> : null}
              {action.type === "back" ? <ChevronLeft /> : null}
            </button>
          ))}
        {titleContent ? (
          <div className="electrobun-webkit-app-region-no-drag min-w-0">
            {titleContent}
          </div>
        ) : (
          <h1 className={`truncate ${getTitleClassName(darkMode)}`}>
            {title}
          </h1>
        )}
      </div>
      <div
        id={WINDOW_TITLE_BAR_RIGHT_CONTEXT_ID}
        data-window-title-bar-right-context
        className="electrobun-webkit-app-region-no-drag flex min-w-0 shrink-0 items-center justify-end gap-2"
      >
        {rightContext}
      </div>
    </div>
  );
};
