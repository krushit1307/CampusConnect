import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GyroToggle } from "./GyroToggle";

describe("GyroToggle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders as a button with switch role", () => {
    render(<GyroToggle />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  it("shows checked state when checked prop is true", () => {
    render(<GyroToggle checked />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeChecked();
  });

  it("calls onCheckedChange when clicked", () => {
    const handleChange = vi.fn();
    render(<GyroToggle onCheckedChange={handleChange} />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("does not call onCheckedChange when disabled", () => {
    const handleChange = vi.fn();
    render(<GyroToggle disabled onCheckedChange={handleChange} />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("toggles on space key press", () => {
    const handleChange = vi.fn();
    render(<GyroToggle onCheckedChange={handleChange} />);
    const toggle = screen.getByRole("switch");
    fireEvent.keyDown(toggle, { key: " " });
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("toggles on enter key press", () => {
    const handleChange = vi.fn();
    render(<GyroToggle onCheckedChange={handleChange} />);
    const toggle = screen.getByRole("switch");
    fireEvent.keyDown(toggle, { key: "Enter" });
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("applies custom className", () => {
    render(<GyroToggle className="custom-class" />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveClass("custom-class");
  });

  it("applies custom id", () => {
    render(<GyroToggle id="test-toggle" />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("id", "test-toggle");
  });

  it("applies aria-label", () => {
    render(<GyroToggle aria-label="Test toggle" />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-label", "Test toggle");
  });

  it("passes through additional props", () => {
    render(<GyroToggle data-testid="custom-toggle" />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("data-testid", "custom-toggle");
  });

  it("shows neumorphic styling with CSS custom properties", () => {
    render(<GyroToggle />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveStyle({ "--shadow-x": "0px" });
    expect(toggle).toHaveStyle({ "--shadow-y": "0px" });
  });
});
