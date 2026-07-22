import { WindowTitleBar } from "./components/app/WindowTitleBar";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useWindowControls } from "./hooks/useWindowControls";
import { SubtitleMuxPage } from "./pages/subtitle-mux/SubtitleMuxPage";

const SubtitleDuck = () => {
  const { darkMode } = useTheme();
  const { minimizeWindow, closeWindow } = useWindowControls();

  return (
    <div className="window-shell h-dvh">
      <main className="app-shell flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px]">
        <WindowTitleBar
          title="字幕鸭"
          darkMode={darkMode}
          onMinimize={() => void minimizeWindow()}
          onClose={() => void closeWindow()}
        />
        <SubtitleMuxPage />
      </main>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <SubtitleDuck />
    </ThemeProvider>
  );
}
