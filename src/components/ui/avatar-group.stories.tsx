import type { Meta, StoryObj } from "@storybook/react-vite";

import { AvatarGroup } from "./avatar-group";

const FIRST_NAMES = [
  "Alice",
  "Bob",
  "Charlie",
  "Dana",
  "Evan",
  "Fiona",
  "George",
  "Hana",
  "Ivan",
  "Julia",
  "Kai",
  "Lina",
];

const LAST_NAMES = [
  "Smith",
  "Brown",
  "Johnson",
  "Wilson",
  "Davis",
  "Miller",
  "Garcia",
  "Clark",
  "Lewis",
  "Hall",
  "Young",
  "King",
];

// 50 deterministic users so the story renders the "+46" aggregation scenario
// from issue #2570 byte-identically on every CI run.
const users = Array.from({ length: 50 }, (_, i) => ({
  name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
}));

const meta: Meta<typeof AvatarGroup> = {
  title: "UI/AvatarGroup",
  component: AvatarGroup,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof AvatarGroup>;

export const Default: Story = {
  args: {
    users,
    max: 4,
  },
};

export const SmallGroup: Story = {
  args: {
    users: users.slice(0, 3),
    max: 4,
  },
};

export const AggressiveOverlap: Story = {
  args: {
    users,
    max: 4,
    overlap: 20,
    size: 48,
  },
};
