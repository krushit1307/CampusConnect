import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RegistrarSyncStatusWidget } from "../admin/RegistrarSyncStatusWidget";
import {
  getRegistrarSyncLogs,
  runRegistrarBatchSync,
} from "@/services/registrarVerificationService";

vi.mock("@/services/registrarVerificationService", () => ({
  getRegistrarSyncLogs: vi.fn(),
  runRegistrarBatchSync: vi.fn(),
}));

describe("RegistrarSyncStatusWidget Component (#3691)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders registrar directory integration status and empty audit log message", async () => {
    (getRegistrarSyncLogs as any).mockResolvedValue([]);

    render(<RegistrarSyncStatusWidget />);

    await waitFor(() => {
      expect(screen.getByTestId("registrar-sync-widget")).toBeInTheDocument();
      expect(screen.getByText(/University Registrar Directory Integration/i)).toBeInTheDocument();
      expect(screen.getByTestId("empty-logs-message")).toBeInTheDocument();
      expect(screen.getByTestId("run-registrar-sync-btn")).toBeInTheDocument();
    });
  });

  it("triggers runRegistrarBatchSync when Run Manual Batch Sync button is clicked", async () => {
    const mockLog = {
      id: "log-1",
      user_id: "user-expelled",
      student_id: "STD-EX-99",
      user_full_name: "Bob Inactive",
      previous_status: "active",
      new_status: "inactive",
      action_taken: "ACCOUNT_LOCKED_SESSIONS_REVOKED_ROSTER_PURGED",
      clubs_notified_count: 2,
      created_at: new Date().toISOString(),
    };

    (getRegistrarSyncLogs as any).mockResolvedValueOnce([]).mockResolvedValueOnce([mockLog]);

    (runRegistrarBatchSync as any).mockResolvedValue({
      totalSynced: 10,
      activeCount: 9,
      purgedCount: 1,
      logs: [mockLog],
    });

    render(<RegistrarSyncStatusWidget />);

    await waitFor(() => {
      expect(screen.getByTestId("run-registrar-sync-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("run-registrar-sync-btn"));

    await waitFor(() => {
      expect(runRegistrarBatchSync).toHaveBeenCalled();
      expect(screen.getByText(/Bob Inactive/i)).toBeInTheDocument();
      expect(screen.getByText(/2 Club Presidents Notified/i)).toBeInTheDocument();
    });
  });
});
