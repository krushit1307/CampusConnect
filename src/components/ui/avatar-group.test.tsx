import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvatarGroup, type AvatarGroupUser } from "./avatar-group";

const users: AvatarGroupUser[] = [
  { name: "John Doe" },
  { name: "Alice Smith" },
  { name: "Bob Johnson" },
  { name: "Emma Brown" },
  { name: "Chris Green" },
  { name: "Dana White" },
  { name: "Evan Black" },
];

function avatarSpan(name: string): HTMLElement {
  const fallback = screen.getByText(name);
  const root = fallback.parentElement;
  if (!root) throw new Error(`Avatar root for "${name}" not found`);
  return root;
}

describe("AvatarGroup", () => {
  it("renders at most max avatars and aggregates the rest", () => {
    render(<AvatarGroup users={users} />);

    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText("AS")).toBeInTheDocument();
    expect(screen.getByText("BJ")).toBeInTheDocument();
    expect(screen.getByText("EB")).toBeInTheDocument();
    expect(screen.queryByText("CG")).not.toBeInTheDocument();
  });

  it("renders a +N bubble with the remaining count", () => {
    render(<AvatarGroup users={users} />);

    const bubble = screen.getByRole("img", { name: "3 more people" });
    expect(bubble).toHaveTextContent("+3");
  });

  it("does not render a +N bubble when the count fits within max", () => {
    render(<AvatarGroup users={users.slice(0, 3)} />);

    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText("AS")).toBeInTheDocument();
    expect(screen.getByText("BJ")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /more people/ })).not.toBeInTheDocument();
  });

  it("honors a custom max prop", () => {
    render(<AvatarGroup users={users} max={2} />);

    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText("AS")).toBeInTheDocument();
    expect(screen.queryByText("BJ")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "5 more people" })).toHaveTextContent("+5");
  });

  it("can hide the +N bubble with showRemaining", () => {
    render(<AvatarGroup users={users} showRemaining={false} />);

    expect(screen.queryByRole("img", { name: /more people/ })).not.toBeInTheDocument();
  });

  it("applies negative margin overlap to every avatar except the first", () => {
    render(<AvatarGroup users={users} />);

    expect(avatarSpan("JD").style.marginLeft).toBe("");
    expect(avatarSpan("AS").style.marginLeft).toBe("-12px");
    expect(avatarSpan("BJ").style.marginLeft).toBe("-12px");
  });

  it("applies a solid 2px border to each avatar", () => {
    render(<AvatarGroup users={users} />);

    expect(avatarSpan("JD").style.border).toContain("2px solid");
    expect(avatarSpan("AS").style.border).toContain("2px solid");
  });

  it("lays the first avatar on top using reverse z-index", () => {
    render(<AvatarGroup users={users} />);

    expect(avatarSpan("JD").style.zIndex).toBe(String(users.length));
    expect(avatarSpan("AS").style.zIndex).toBe(String(users.length - 1));
    expect(avatarSpan("EB").style.zIndex).toBe(String(users.length - 3));
    expect(screen.getByRole("img", { name: "3 more people" }).style.zIndex).toBe(
      String(users.length - 4),
    );
  });

  it("supports custom overlap and border color", () => {
    render(<AvatarGroup users={users} overlap={8} borderColor="#000000" />);

    expect(avatarSpan("AS").style.marginLeft).toBe("-8px");
    expect(avatarSpan("AS").style.border).toContain("rgb(0, 0, 0)");
  });

  it("renders an empty container for an empty user list", () => {
    const { container } = render(<AvatarGroup users={[]} />);

    expect(container.firstElementChild?.children.length).toBe(0);
  });
});
