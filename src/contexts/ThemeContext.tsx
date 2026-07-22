import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { desktopApi } from "@/desktop/client";
import {
  getDefaultUiFontSize,
  getInitialUiFontSize,
  UI_FONT_SIZE_CONFIG_KEY,
  type UiFontSize,
} from "@/settings/uiFontSize";
import { detectUiPlatform } from "../utils/platform";

interface ThemeContextType {
  darkMode: boolean;
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
  const [darkMode] = useState(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    const isDark = savedDarkMode === null ? true : savedDarkMode === "true";

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    return isDark;
  });
  const [uiFontSize, setUiFontSize] = useState<UiFontSize>(() => {
    const value = getDefaultUiFontSize(initialPlatform);
    applyUiFontSizeDataset(value);
    return value;
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
      setUiFontSize(nextValue);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    applyUiFontSizeDataset(uiFontSize);
  }, [uiFontSize]);

  return (
    <ThemeContext.Provider value={{ darkMode }}>
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
