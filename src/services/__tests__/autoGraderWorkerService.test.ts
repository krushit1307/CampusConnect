// =============================================================================
// Integration Tests: AutoGraderWorkerService
// Issue: #5131 - Automated "Event Series" GitHub Classroom Auto-Grader Load Balancer
// Description: Exhaustive tests for worker batch processing, Docker sandbox limits,
// idempotency protection, SQS acknowledgment, and Spot interruption resilience.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AutoGraderWorkerService } from "../autoGraderWorkerService";
import { SqsGraderQueueService } from "../sqsGraderQueueService";
import { ClassroomSubmissionJob } from "../../types/autoGraderLoadBalancer";

describe("AutoGraderWorkerService (#5131)", () => {
  let queueService: SqsGraderQueueService;
  let workerService: AutoGraderWorkerService;

  const mockPassJob: ClassroomSubmissionJob = {
    submissionId: "sub-pass-001",
    seriesId: "series-algo-2026",
    assignmentId: "assign-binary-tree",
    studentHandle: "ada_lovelace",
    repoUrl: "https://github.com/ada/tree",
    commitSha: "sha_tree_001",
    code: "def solve(): return True\nprint(solve())",
    language: "python",
    enqueuedAt: new Date().toISOString(),
    attemptCount: 0,
  };

  const mockFailJob: ClassroomSubmissionJob = {
    submissionId: "sub-fail-002",
    seriesId: "series-algo-2026",
    assignmentId: "assign-binary-tree",
    studentHandle: "student_buggy",
    repoUrl: "https://github.com/buggy/tree",
    commitSha: "sha_tree_002",
    code: "raise Exception('AssertionError')",
    language: "python",
    enqueuedAt: new Date().toISOString(),
    attemptCount: 0,
  };

  const mockTimeoutJob: ClassroomSubmissionJob = {
    submissionId: "sub-timeout-003",
    seriesId: "series-algo-2026",
    assignmentId: "assign-binary-tree",
    studentHandle: "student_loop",
    repoUrl: "https://github.com/loop/tree",
    commitSha: "sha_tree_003",
    code: "import time\ntime.sleep(99)",
    language: "python",
    enqueuedAt: new Date().toISOString(),
    attemptCount: 0,
  };

  beforeEach(() => {
    queueService = new SqsGraderQueueService();
    workerService = new AutoGraderWorkerService("pod_test_node_01", queueService);
  });

  afterEach(() => {
    queueService.clearAll();
  });

  it("processes a batch of queued submissions and returns PASSED result", async () => {
    queueService.enqueueSubmission(mockPassJob);

    const results = await workerService.processNextBatch(5);

    expect(results).toHaveLength(1);
    const res = results[0];

    expect(res.submissionId).toBe("sub-pass-001");
    expect(res.status).toBe("PASSED");
    expect(res.exitCode).toBe(0);
    expect(res.secureSandbox).toBe(true);

    // Verified message acknowledged & removed from SQS in-flight
    const metrics = queueService.getMetrics();
    expect(metrics.messagesInFlight).toBe(0);
    expect(metrics.queueDepth).toBe(0);
  });

  it("handles code errors and sets status to FAILED", async () => {
    queueService.enqueueSubmission(mockFailJob);

    const results = await workerService.processNextBatch(5);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("FAILED");
    expect(results[0].exitCode).toBe(1);
    expect(results[0].stdout).toContain("AssertionError");
  });

  it("enforces 10s strict execution timeout and sets status to TIMED_OUT", async () => {
    queueService.enqueueSubmission(mockTimeoutJob);

    const results = await workerService.processNextBatch(5);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("TIMED_OUT");
    expect(results[0].exitCode).toBe(124);
  });

  it("enforces idempotency: duplicate execution returns cached result without re-running container", async () => {
    const res1 = await workerService.executeGradingSandbox(mockPassJob);
    workerService.persistGradeResult(res1);

    // Call second time with same submissionId
    const res2 = await workerService.executeGradingSandbox(mockPassJob);

    expect(res2).toEqual(res1);
  });

  it("tolerates Spot Interruption: unacknowledged message remains in SQS for clean retry", async () => {
    queueService.enqueueSubmission(mockPassJob);

    // Poll message from SQS (message now in flight)
    const polled = queueService.pollSubmissions(1);
    expect(polled).toHaveLength(1);

    // Simulate Spot node termination BEFORE acknowledgment
    // SQS message was NOT acknowledged
    const metricsBefore = queueService.getMetrics();
    expect(metricsBefore.messagesInFlight).toBe(1);

    // The result was not acknowledged; a new worker can re-poll after visibility timeout or retry
    expect(queueService.acknowledgeMessage("invalid_handle")).toBe(false);
  });
});
