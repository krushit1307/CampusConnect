// =============================================================================
// Unit Tests: SqsGraderQueueService
// Issue: #5131 - Automated "Event Series" GitHub Classroom Auto-Grader Load Balancer
// Description: Tests for AWS SQS submission queueing, polling, visibility timeouts,
// DLQ routing, 500-submission spike simulation, and autoscaler metrics.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqsGraderQueueService } from "../sqsGraderQueueService";
import { ClassroomSubmissionJob } from "../../types/autoGraderLoadBalancer";

describe("SqsGraderQueueService (#5131)", () => {
  let queueService: SqsGraderQueueService;

  const mockJob: ClassroomSubmissionJob = {
    submissionId: "sub-101",
    seriesId: "series-cs101",
    assignmentId: "assign-lab1",
    studentHandle: "octocat",
    repoUrl: "https://github.com/octocat/lab1",
    commitSha: "abc123def",
    code: "print('Hello World')",
    language: "python",
    enqueuedAt: new Date().toISOString(),
    attemptCount: 0,
  };

  beforeEach(() => {
    queueService = new SqsGraderQueueService();
  });

  afterEach(() => {
    queueService.clearAll();
  });

  it("enqueues a submission job into SQS queue and updates queue metrics", () => {
    const receipt = queueService.enqueueSubmission(mockJob);

    expect(receipt).toBeDefined();
    expect(receipt.messageId).toBeDefined();
    expect(receipt.receiptHandle).toBeDefined();
    expect(receipt.job.submissionId).toBe("sub-101");

    const metrics = queueService.getMetrics();
    expect(metrics.queueDepth).toBe(1);
    expect(metrics.messagesInFlight).toBe(0);
  });

  it("polls submissions from SQS queue and transitions them to in-flight state", () => {
    queueService.enqueueSubmission(mockJob);

    const polled = queueService.pollSubmissions(5);

    expect(polled).toHaveLength(1);
    expect(polled[0].job.submissionId).toBe("sub-101");

    const metrics = queueService.getMetrics();
    expect(metrics.queueDepth).toBe(0);
    expect(metrics.messagesInFlight).toBe(1);
  });

  it("acknowledges and deletes message from SQS upon successful completion", () => {
    const receipt = queueService.enqueueSubmission(mockJob);
    queueService.pollSubmissions(5);

    const ack = queueService.acknowledgeMessage(receipt.receiptHandle);

    expect(ack).toBe(true);

    const metrics = queueService.getMetrics();
    expect(metrics.queueDepth).toBe(0);
    expect(metrics.messagesInFlight).toBe(0);
  });

  it("routes repeatedly failing jobs (attempts >= 3) to Dead-Letter Queue (DLQ)", () => {
    queueService.moveToDeadLetterQueue(mockJob, "SyntaxError in script");

    const metrics = queueService.getMetrics();
    expect(metrics.dlqDepth).toBe(1);
  });

  it("simulates a 500 simultaneous submission spike for load testing and autoscaler benchmarking", () => {
    const spike = queueService.simulateSubmissionSpike(500, "series-cs101-spike");

    expect(spike).toHaveLength(500);

    const metrics = queueService.getMetrics();
    expect(metrics.queueDepth).toBe(500);
    // HPA metric calculation: 500 messages / 10 target per pod = 50 max worker pods
    expect(metrics.activeWorkerPods).toBe(50);
    // Spot node calculation: 50 pods / 4 per node = 13 Spot nodes
    expect(metrics.spotNodesAllocated).toBe(13);
  });
});
