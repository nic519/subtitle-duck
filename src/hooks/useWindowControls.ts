import { desktopApi } from "../desktop/client";

export const useWindowControls = () => {
  const minimizeWindow = async () => {
    try {
      await desktopApi.minimizeWindow();
    } catch (err) {
      console.error("Failed to minimize window:", err);
    }
  };

  const closeWindow = async () => {
    try {
      await desktopApi.closeWindow();
    } catch (err) {
      console.error("Failed to close window:", err);
    }
  };

  return { minimizeWindow, closeWindow };
};
