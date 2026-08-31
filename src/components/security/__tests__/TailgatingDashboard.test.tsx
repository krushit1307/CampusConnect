import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TailgatingDashboard } from "../TailgatingDashboard";
import { tailgatingService } from "../../../services/tailgatingService";

// Mock tailgatingService
vi.mock("../../../services/tailgatingService", () => {
  const getSecurityIncidents = vi.fn();
  const getProviderHealths = vi.fn().mockReturnValue({
    access_control: "HEALTHY",
    camera_counting: "HEALTHY",
    alarms: "HEALTHY",
    notifications: "HEALTHY",
  });
  const acknowledgeIncident = vi.fn();
  const resolveIncident = vi.fn();
  const getAuditLogs = vi.fn().mockReturnValue([
    {
      id: "log-1",
      action: "ACKNOWLEDGE_INCIDENT",
      userId: "officer-john",
      userRole: "SECURITY_OFFICER",
      timestamp: new Date().toISOString(),
      details: "Acknowledged threat at Door ID: door-1111",
    },
  ]);

  return {
    tailgatingService: {
      getSecurityIncidents,
      getProviderHealths,
      acknowledgeIncident,
      resolveIncident,
      getAuditLogs,
    },
  };
});

describe("TailgatingDashboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state correctly when there are no incidents", async () => {
    const getIncidentsMock = tailgatingService.getSecurityIncidents as any;
    getIncidentsMock.mockResolvedValue([]);

    render(<TailgatingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Perimeter secure/i)).toBeInTheDocument();
    });
  });

  it("renders loaded security breaches list with expected severity tags", async () => {
    const mockIncident = {
      id: "evt-123",
      doorId: "door-1111-2222-3333-4444",
      cameraId: "cam-lobby-01",
      timestamp: new Date().toISOString(),
      severity: "HIGH",
      confidence: 0.88,
      observedCount: 2,
      expectedCount: 1,
      correlationId: "swipe-99",
      status: "NEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const getIncidentsMock = tailgatingService.getSecurityIncidents as any;
    getIncidentsMock.mockResolvedValue([mockIncident]);

    render(<TailgatingDashboard />);

    await waitFor(() => {
      expect(screen.getByText("HIGH")).toBeInTheDocument();
      expect(screen.getByText(/Door ID: door-111/i)).toBeInTheDocument();
      expect(screen.getByText("2 people")).toBeInTheDocument();
    });
  });

  it("opens detail response panel when incident is clicked", async () => {
    const mockIncident = {
      id: "evt-123",
      doorId: "door-1111-2222-3333-4444",
      cameraId: "cam-lobby-01",
      timestamp: new Date().toISOString(),
      severity: "HIGH",
      confidence: 0.88,
      observedCount: 2,
      expectedCount: 1,
      correlationId: "swipe-99",
      status: "NEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const getIncidentsMock = tailgatingService.getSecurityIncidents as any;
    getIncidentsMock.mockResolvedValue([mockIncident]);

    render(<TailgatingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Door ID: door-111/i)).toBeInTheDocument();
    });

    const card = screen.getByText(/Door ID: door-111/i);
    fireEvent.click(card);

    expect(screen.getByText("Incident evt-123")).toBeInTheDocument();
    expect(screen.getByText("Acknowledge Threat")).toBeInTheDocument();
  });

  it("triggers acknowledge action and updates state", async () => {
    const mockIncident = {
      id: "evt-123",
      doorId: "door-1111-2222-3333-4444",
      cameraId: "cam-lobby-01",
      timestamp: new Date().toISOString(),
      severity: "HIGH",
      confidence: 0.88,
      observedCount: 2,
      expectedCount: 1,
      correlationId: "swipe-99",
      status: "NEW",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const getIncidentsMock = tailgatingService.getSecurityIncidents as any;
    getIncidentsMock.mockResolvedValue([mockIncident]);

    const ackMock = tailgatingService.acknowledgeIncident as any;
    ackMock.mockResolvedValue(true);

    render(<TailgatingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Door ID: door-111/i)).toBeInTheDocument();
    });

    const card = screen.getByText(/Door ID: door-111/i);
    fireEvent.click(card);

    const ackBtn = screen.getByText("Acknowledge Threat");
    fireEvent.click(ackBtn);

    await waitFor(() => {
      expect(tailgatingService.acknowledgeIncident).toHaveBeenCalledWith(
        "evt-123",
        "officer-web-01",
      );
    });
  });

  it("resolves incident when notes are provided", async () => {
    const mockIncident = {
      id: "evt-123",
      doorId: "door-1111-2222-3333-4444",
      cameraId: "cam-lobby-01",
      timestamp: new Date().toISOString(),
      severity: "HIGH",
      confidence: 0.88,
      observedCount: 2,
      expectedCount: 1,
      correlationId: "swipe-99",
      status: "ACKNOWLEDGED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const getIncidentsMock = tailgatingService.getSecurityIncidents as any;
    getIncidentsMock.mockResolvedValue([mockIncident]);

    const resolveMock = tailgatingService.resolveIncident as any;
    resolveMock.mockResolvedValue(true);

    render(<TailgatingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Door ID: door-111/i)).toBeInTheDocument();
    });

    const card = screen.getByText(/Door ID: door-111/i);
    fireEvent.click(card);

    // Type notes
    const notesInput = screen.getByPlaceholderText(/Provide details about the response/i);
    fireEvent.change(notesInput, {
      target: { value: "Perimeter check secure. False positive tailgating trigger." },
    });

    const submitBtn = screen.getByRole("button", { name: /Submit Close Report/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(tailgatingService.resolveIncident).toHaveBeenCalledWith(
        "evt-123",
        "RESOLVED",
        "officer-web-01",
        "Perimeter check secure. False positive tailgating trigger.",
      );
    });
  });

  it("renders audit log list in tab", async () => {
    const getIncidentsMock = tailgatingService.getSecurityIncidents as any;
    getIncidentsMock.mockResolvedValue([]);

    render(<TailgatingDashboard />);

    const auditTabBtn = screen.getByRole("button", { name: /Audit Log/i });
    fireEvent.click(auditTabBtn);

    expect(screen.getByText("Acknowledged threat at Door ID: door-1111")).toBeInTheDocument();
  });
});
