import { useEffect, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { desktopApi } from "../../desktop/client";
import { SubtitleMuxPageContent } from "./SubtitleMuxPageContent";
import type { SubtitleToolId } from "./subtitleMuxPageTypes";
import { useSubtitleGeneration } from "./useSubtitleGeneration";
import { useSubtitleMerge } from "./useSubtitleMerge";
import { useSubtitleTranslation } from "./useSubtitleTranslation";
const SUBTITLE_MUX_ACTIVE_TOOL_CONFIG_KEY = "subtitle_mux_active_tool";
const isSubtitleToolId = (value: string | null): value is SubtitleToolId =>
  value === "merge" || value === "generate" || value === "translate";
interface SubtitleMuxPageProps {
  initialActiveTool?: SubtitleToolId;
}
/** 页面只负责主题与工具导航，三个工作流独立持有状态并保持挂载。 */
export const SubtitleMuxPage = ({
  initialActiveTool = "merge",
}: SubtitleMuxPageProps) => {
  const { darkMode } = useTheme();

  const [activeTool, setActiveTool] =
    useState<SubtitleToolId>(initialActiveTool);

  useEffect(() => {
    if (initialActiveTool !== "merge") {
      void desktopApi.configSet(
        SUBTITLE_MUX_ACTIVE_TOOL_CONFIG_KEY,
        initialActiveTool,
      );
      return;
    }
    void desktopApi
      .configGet(SUBTITLE_MUX_ACTIVE_TOOL_CONFIG_KEY)
      .then((value) => {
        if (isSubtitleToolId(value)) setActiveTool(value);
      });
  }, [initialActiveTool]);

  const handleChangeActiveTool = (toolId: SubtitleToolId) => {
    setActiveTool(toolId);
    void desktopApi.configSet(SUBTITLE_MUX_ACTIVE_TOOL_CONFIG_KEY, toolId);
  };
  const merge = useSubtitleMerge();
  const translation = useSubtitleTranslation();
  const generation = useSubtitleGeneration();
  return (
    <div
      className={`flex h-full flex-col overflow-hidden bg-[var(--settings-bg)] ${
        darkMode ? "text-white" : "text-gray-900"
      }`}
    >
      <SubtitleMuxPageContent
        darkMode={darkMode}
        activeTool={activeTool}
        onChangeActiveTool={handleChangeActiveTool}
        {...merge}
        {...translation}
        {...generation}
      />
    </div>
  );
};
