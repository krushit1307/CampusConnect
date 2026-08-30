// =============================================================================
// Component Tests: AutoGraderMonitorDashboard
// Issue: #5131 - Automated "Event Series" GitHub Classroom Auto-Grader Load Balancer
// Description: RTL component tests for SQS queue metrics display, active worker pods,
// Spot instance allocation, and 500-submission spike load test simulation.
// =============================================================================

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AutoGraderMonitorDashboard } from "../AutoGraderMonitorDashboard";
import { globalSqsGraderQueueService } from "@/services/sqsGraderQueueService";

describe("AutoGraderMonitorDashboard Component (#5131)", () => {
  beforeEach(() => {
    globalSqsGraderQueueService.clearAll();
  });

  afterEach(() => {
    globalSqsGraderQueueService.clearAll();
  });

  it("renders SQS queue depth, active worker pods, and Spot EC2 metric cards", () => {
    render(<AutoGraderMonitorDashboard />);

    expect(screen.getByTestId("auto-grader-monitor-dashboard")).toBeInTheDocument();
    expect(screen.getByText(/GitHub Classroom Auto-Grader Telemetry/i)).toBeInTheDocument();

    expect(screen.getByTestId("metric-queue-depth")).toBeInTheDocument();
    expect(screen.getByTestId("metric-worker-pods")).toBeInTheDocument();
    expect(screen.getByTestId("simulate-500-spike-btn")).toBeInTheDocument();
  });

  it("updates queue metrics to 500 queued and 50 worker pods on spike simulation trigger", () => {
    render(<AutoGraderMonitorDashboard />);

    const spikeBtn = screen.getByTestId("simulate-500-spike-btn");

    act(() => {
      fireEvent.click(spikeBtn);
    });

    const queueMetric = screen.getByTestId("metric-queue-depth");
    const podMetric = screen.getByTestId("metric-worker-pods");

    expect(queueMetric).toHaveTextContent("500");
    expect(podMetric).toHaveTextContent("50");
  });

  it("runs worker batch processing and renders execution results table", async () => {
    // 1. Enqueue 2 submissions
    globalSqsGraderQueueService.enqueueSubmission({
      submissionId: "sub-ui-1",
      seriesId: "series-ui-test",
      assignmentId: "assign-1",
      studentHandle: "octocat",
      repoUrl: "https://github.com/octocat/repo",
      commitSha: "sha123",
      code: "print('ui test')",
      language: "python",
      enqueuedAt: new Date().toISOString(),
      attemptCount: 0,
    });

    render(<AutoGraderMonitorDashboard />);

    const processBtn = screen.getByTestId("process-worker-batch-btn");

    await act(async () => {
      fireEvent.click(processBtn);
    });

    expect(screen.getByText(/sub-ui-1/i)).toBeInTheDocument();
    expect(screen.getByText(/octocat/i)).toBeInTheDocument();
  });
});
