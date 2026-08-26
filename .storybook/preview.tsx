import type { Preview } from "@storybook/react-vite";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },

    // Charts must render completely (animations disabled in stories) before a
    // screenshot is snapped, otherwise Chromatic can capture a partially drawn
    // SVG. 1000ms gives Chromatic a stable frame to compare against.
    chromatic: { delay: 1000 },
  },
};

export default preview;
