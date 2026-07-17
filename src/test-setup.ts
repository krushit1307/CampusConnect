import { vi } from "vitest";

vi.mock("tailwind-merge", () => ({
  twMerge: (...args: string[]) => args.filter(Boolean).join(" "),
}));
