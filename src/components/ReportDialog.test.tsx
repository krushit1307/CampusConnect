import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReportDialog } from "./ReportDialog";

describe("ReportDialog Component", () => {
  it("renders report form when open", () => {
    render(<ReportDialog isOpen={true} onClose={vi.fn()} targetType="post" targetId="post-123" />);

    expect(screen.getByText("Report Content")).toBeInTheDocument();
    expect(screen.getByText("Reason for report")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Spam" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Harassment" })).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ReportDialog isOpen={true} onClose={onClose} targetType="comment" targetId="comment-456" />,
    );

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
