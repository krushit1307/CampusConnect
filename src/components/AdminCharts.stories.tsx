import type { Meta, StoryObj } from "@storybook/react-vite";
import AdminCharts from "./AdminCharts";

// Strict, hardcoded mock data so the rendered chart is byte-identical on every
// CI run. Never feed this component live/fetching data in Storybook, or the
// visual diff will fail on unrelated data changes.
const MOCK_DATA = [
  { month: "January", reports: 10, resolved: 8 },
  { month: "February", reports: 20, resolved: 15 },
  { month: "March", reports: 30, resolved: 25 },
  { month: "April", reports: 20, resolved: 18 },
  { month: "May", reports: 30, resolved: 28 },
];

const meta: Meta<typeof AdminCharts> = {
  title: "Analytics/ReportsAreaChart",
  component: AdminCharts,
  parameters: {
    layout: "padded",
    // Chromatic: give the SVG a stable frame and ignore sub-pixel anti-aliasing
    // differences between CI runners (Linux/Chromium vs macOS/Chromium).
    chromatic: {
      delay: 1000,
      diffThreshold: 0.15,
    },
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof AdminCharts>;

export const Default: Story = {
  args: {
    data: MOCK_DATA,
    isAnimationActive: false,
  },
};
