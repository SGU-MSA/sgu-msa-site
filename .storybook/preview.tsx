import type { Preview } from "@storybook/nextjs-vite";
import { useEffect } from "react";

import { fontVariables } from "../src/app/fonts";
import { MotionRoot } from "../src/shared/layout/MotionRoot";
import "../src/app/globals.css";

/**
 * Every story renders on the same tokens as the site. The toolbar sets the
 * same <html> attribute the site uses: data-theme (light Green Ink or Dusk).
 */
const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Light or dark (data-theme)",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light (Green Ink)" },
          { value: "dark", title: "Dark (Dusk)" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    controls: { expanded: true },
    a11y: { test: "error" },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === "dark" ? "dark" : "light";
      function Root() {
        useEffect(() => {
          const root = document.documentElement;
          root.className = fontVariables;
          root.setAttribute("data-theme", theme);
          root.setAttribute("data-theme-choice", theme);
        });
        return (
          <MotionRoot>
            <Story />
          </MotionRoot>
        );
      }
      return <Root />;
    },
  ],
};

export default preview;
