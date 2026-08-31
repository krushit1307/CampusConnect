// =============================================================================
// Service: SqsGraderQueueService
// Issue: #5131 - Automated "Event Series" GitHub Classroom Auto-Grader Load Balancer
// Description: Decoupled AWS SQS submission queue producer & consumer manager.
// Handles asynchronous job enqueueing, visibility timeouts, DLQ routing, and queue metrics.
// =============================================================================

import {
  ClassroomSubmissionJob,
  SqsMessageReceipt,
  QueueMetrics,
} from "../types/autoGraderLoadBalancer";

export class SqsGraderQueueService {
  private queue: Map<string, SqsMessageReceipt> = new Map();
  private inFlightMessages: Map<string, { receipt: SqsMessageReceipt; expiresAt: number }> =
    new Map();
  private deadLetterQueue: Map<
    string,
    { job: ClassroomSubmissionJob; reason: string; failedAt: string }
  > = new Map();
  private maxAttempts: number = 3;
  private visibilityTimeoutMs: number = 60000; // 60s visibility timeout

  /**
   * Enqueues a GitHub Classroom submission job into AWS SQS queue.
   */
  public enqueueSubmission(job: ClassroomSubmissionJob): SqsMessageReceipt {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const receiptHandle = `rh_${messageId}_${Math.random().toString(36).substring(2, 7)}`;

    const receipt: SqsMessageReceipt = {
      messageId,
      receiptHandle,
      job: {
        ...job,
        attemptCount: job.attemptCount || 0,
        enqueuedAt: job.enqueuedAt || new Date().toISOString(),
      },
    };

    this.queue.set(messageId, receipt);
    return receipt;
  }

  /**
   * Polls messages from SQS queue for worker processing.
   * Sets visibility timeout to prevent double processing by other workers.
   */
  public pollSubmissions(batchSize: number = 10): SqsMessageReceipt[] {
    const now = Date.now();

    // Reclaim expired in-flight messages (e.g. Worker pod termination or Spot interruption)
    for (const [receiptHandle, item] of this.inFlightMessages.entries()) {
      if (item.expiresAt <= now) {
        // Visibility timeout expired! Return message to queue
        this.inFlightMessages.delete(receiptHandle);
        item.receipt.job.attemptCount += 1;

        if (item.receipt.job.attemptCount >= this.maxAttempts) {
          this.moveToDeadLetterQueue(
            item.receipt.job,
            `Max attempts (${this.maxAttempts}) exceeded due to visibility timeout expiration.`,
          );
        } else {
          this.queue.set(item.receipt.messageId, item.receipt);
        }
      }
    }

    const available = Array.from(this.queue.values()).slice(0, batchSize);
    const polled: SqsMessageReceipt[] = [];

    for (const receipt of available) {
      this.queue.delete(receipt.messageId);
      this.inFlightMessages.set(receipt.receiptHandle, {
        receipt,
        expiresAt: now + this.visibilityTimeoutMs,
      });
      polled.push(receipt);
    }

    return polled;
  }

  /**
   * Acknowledges message by deleting it from SQS AFTER successful grade persistence.
   */
  public acknowledgeMessage(receiptHandle: string): boolean {
    const inFlight = this.inFlightMessages.get(receiptHandle);
    if (!inFlight) return false;

    this.inFlightMessages.delete(receiptHandle);
    return true;
  }

  /**
   * Routes ungradable or repeatedly failing jobs to the Dead-Letter Queue (DLQ).
   */
  public moveToDeadLetterQueue(job: ClassroomSubmissionJob, reason: string): void {
    this.deadLetterQueue.set(job.submissionId, {
      job,
      reason,
      failedAt: new Date().toISOString(),
    });
  }

  /**
   * Simulates a 500 simultaneous submission spike for load testing and autoscaler benchmarking.
   */
  public simulateSubmissionSpike(
    count: number = 500,
    seriesId: string = "series-cs101-2026",
  ): SqsMessageReceipt[] {
    const generated: SqsMessageReceipt[] = [];

    for (let i = 1; i <= count; i++) {
      const receipt = this.enqueueSubmission({
        submissionId: `sub_spike_${i}_${Date.now()}`,
        seriesId,
        assignmentId: `assign_lab_${(i % 5) + 1}`,
        studentHandle: `student_${i}`,
        repoUrl: `https://github.com/campus-connect/assignment-${i}`,
        commitSha: `sha_${Math.random().toString(36).substring(2, 10)}`,
        code: `print("Auto-grader test submission #${i}")`,
        language: "python",
        enqueuedAt: new Date().toISOString(),
        attemptCount: 0,
      });
      generated.push(receipt);
    }

    return generated;
  }

  /**
   * Returns current queue metrics for monitoring & Kubernetes HPA / KEDA scaling signals.
   */
  public getMetrics(): QueueMetrics {
    const queueDepth = this.queue.size;
    const messagesInFlight = this.inFlightMessages.size;
    const dlqDepth = this.deadLetterQueue.size;

    // Calculate required worker pods (10 messages target per pod, max 50 pods)
    const totalPending = queueDepth + messagesInFlight;
    const activeWorkerPods = Math.min(50, Math.ceil(totalPending / 10));

    // EC2 Spot Nodes needed (approx 4 worker pods per Spot node)
    const spotNodesAllocated = Math.ceil(activeWorkerPods / 4);

    return {
      queueDepth,
      messagesInFlight,
      dlqDepth,
      activeWorkerPods,
      spotNodesAllocated,
      targetWorkloadCapacity: 500,
    };
  }

  public clearAll(): void {
    this.queue.clear();
    this.inFlightMessages.clear();
    this.deadLetterQueue.clear();
  }
}

export const globalSqsGraderQueueService = new SqsGraderQueueService();
