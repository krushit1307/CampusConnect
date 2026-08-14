import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Foundations/Button",
  component: Button,
  // This magic line auto-generates the MDX page and prop tables!
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The Button component allows users to trigger actions, submit forms, or navigate through the application.

### ✅ Do's
* **Prioritize actions:** Use the **Primary** variant for the main, most important action on a screen.
* **Keep it concise:** Keep button text short, punchy, and actionable (e.g., "Submit", "Save", "Delete").

### ❌ Don'ts
* **Competing actions:** Don't use multiple Primary buttons right next to each other. Use a Secondary or Outline button for the less important action.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: "Click Me",
    variant: "primary",
    size: "md",
  },
};

export const Secondary: Story = {
  args: {
    children: "Secondary Action",
    variant: "secondary",
  },
};

export const Destructive: Story = {
  args: {
    children: "Delete Account",
    variant: "destructive",
  },
};

export const Outline: Story = {
  args: {
    children: "Cancel",
    variant: "outline",
  },
};
