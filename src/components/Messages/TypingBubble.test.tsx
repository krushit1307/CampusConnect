import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TypingBubble } from "./TypingBubble";

describe("TypingBubble", () => {
  it("renders empty div when typingUsers array is empty", () => {
    render(<TypingBubble typingUsers={[]} />);
    expect(screen.getByTestId("typing-bubble-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("typing-bubble")).not.toBeInTheDocument();
  });

  it("renders single user typing text", () => {
    render(<TypingBubble typingUsers={["Alice"]} />);
    expect(screen.getByTestId("typing-bubble")).toBeInTheDocument();
    expect(screen.getByText("Alice is typing…")).toBeInTheDocument();
  });

  it("renders two users typing text", () => {
    render(<TypingBubble typingUsers={["Alice", "Bob"]} />);
    expect(screen.getByTestId("typing-bubble")).toBeInTheDocument();
    expect(screen.getByText("Alice and Bob are typing…")).toBeInTheDocument();
  });

  it("renders several people typing text when more than 2 users", () => {
    render(<TypingBubble typingUsers={["Alice", "Bob", "Charlie"]} />);
    expect(screen.getByTestId("typing-bubble")).toBeInTheDocument();
    expect(screen.getByText("Several people are typing…")).toBeInTheDocument();
  });
});
