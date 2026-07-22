import { ThemeProvider } from "./contexts/ThemeContext";
import { SubtitleMuxPage } from "./pages/subtitle-mux/SubtitleMuxPage";

const SubtitleDuck = () => (
    <div className="window-shell h-dvh">
      <main className="app-shell flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px]">
        <SubtitleMuxPage />
      </main>
    </div>
);

export default function App() {
  return (
    <ThemeProvider>
      <SubtitleDuck />
    </ThemeProvider>
  );
}
