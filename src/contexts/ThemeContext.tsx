import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { desktopApi } from "@/desktop/client";
import {
  getDefaultUiFontSize,
  getInitialUiFontSize,
  sanitizeUiFontSize,
  UI_FONT_SIZE_CONFIG_KEY,
  type UiFontSize,
} from "@/settings/uiFontSize";
import { detectUiPlatform } from "../utils/platform";

interface ThemeContextType {
  darkMode: boolean;
  uiFontSize: UiFontSize;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
  setUiFontSize: (value: UiFontSize) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getCurrentUiPlatform = () => {
  if (typeof navigator === "undefined") return "other";

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };

  return detectUiPlatform(
    navigatorWithUserAgentData.userAgentData?.platform,
    navigator.platform
  );
};

const applyUiFontSizeDataset = (value: UiFontSize) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.uiFontSize = value;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const initialPlatform = getCurrentUiPlatform();
  const [darkMode, setDarkMode] = useState(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    const isDark = savedDarkMode === null ? true : savedDarkMode === "true";

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    return isDark;
  });
  const [uiFontSize, setUiFontSizeState] = useState<UiFontSize>(() => {
    const initialUiFontSize = getDefaultUiFontSize(initialPlatform);
    applyUiFontSizeDataset(initialUiFontSize);
    return initialUiFontSize;
  });

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    const platform = getCurrentUiPlatform();

    document.documentElement.dataset.platform = platform;

    let isMounted = true;
    void desktopApi.configGet(UI_FONT_SIZE_CONFIG_KEY).then((storedValue) => {
      if (!isMounted) return;
      const nextValue = getInitialUiFontSize(platform, storedValue);
      setUiFontSizeState(nextValue);
      applyUiFontSizeDataset(nextValue);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    applyUiFontSizeDataset(uiFontSize);
  }, [uiFontSize]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const setUiFontSize = async (value: UiFontSize) => {
    const nextValue = sanitizeUiFontSize(value) ?? "standard";
    setUiFontSizeState(nextValue);
    applyUiFontSizeDataset(nextValue);
    await desktopApi.configSet(UI_FONT_SIZE_CONFIG_KEY, nextValue);
  };

  return (
    <ThemeContext.Provider
      value={{ darkMode, uiFontSize, toggleDarkMode, setDarkMode, setUiFontSize }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
