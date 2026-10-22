import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { detectUiPlatform } from "../utils/platform";
import { desktopApi } from "../desktop/client";

/** Windows 专用标题栏；CSS 按平台显示，macOS 继续使用原生按钮。 */
export function WindowsTitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!desktopApi.isDesktop || detectUiPlatform(undefined, navigator.platform) !== "windows") return;
    let disposed = false;
    // 最大化也可能由系统快捷键触发，尺寸或焦点变化后读取原生状态。
    const refresh = () => {
      void desktopApi.isWindowMaximized().then(value => {
        if (!disposed) setMaximized(value);
      }).catch(() => { /* 窗口关闭期间的 RPC 失败无需更新界面。 */ });
    };
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("resize", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const maximizeLabel = maximized ? "还原" : "最大化";
  return (
    <header className="windows-title-bar shrink-0" aria-label="窗口标题栏">
      <div className="windows-title-bar-drag electrobun-webkit-app-region-drag" onDoubleClick={desktopApi.toggleMaximizeWindow}>
        <span>字幕鸭</span>
      </div>
      <div className="windows-window-controls electrobun-webkit-app-region-no-drag">
        <button type="button" title="最小化" aria-label="最小化" disabled={!desktopApi.isDesktop} onClick={desktopApi.minimizeWindow}>
          <Minus size={14} aria-hidden="true" />
        </button>
        <button type="button" title={maximizeLabel} aria-label={maximizeLabel} disabled={!desktopApi.isDesktop} onClick={desktopApi.toggleMaximizeWindow}>
          {maximized ? <Copy size={12} aria-hidden="true" /> : <Square size={12} aria-hidden="true" />}
        </button>
        <button type="button" className="windows-close-button" title="关闭" aria-label="关闭" disabled={!desktopApi.isDesktop} onClick={desktopApi.closeWindow}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
