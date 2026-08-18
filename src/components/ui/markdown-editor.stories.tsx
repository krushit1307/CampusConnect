import { MarkdownEditor } from "./markdown-editor";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof MarkdownEditor> = {
  title: "UI/MarkdownEditor",
  component: MarkdownEditor,
};

export default meta;
type Story = StoryObj<typeof MarkdownEditor>;

export const Default: Story = {
  args: {
    value: "Hello CampusConnect! Type your markdown here...",
    onChange: () => {},
  },
};
