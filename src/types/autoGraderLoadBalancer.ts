// =============================================================================
// Types: Automated "Event Series" GitHub Classroom Auto-Grader Load Balancer
// Issue: #5131 - Automated "Event Series" GitHub Classroom Auto-Grader Load Balancer
// Description: Data models for classroom submission jobs, SQS queue payloads,
// worker execution states, grading results, and autoscaler metrics.
// =============================================================================

export type AutoGraderStatus = "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "TIMED_OUT" | "ERROR";

export interface ClassroomSubmissionJob {
  submissionId: string;
  seriesId: string;
  assignmentId: string;
  studentHandle: string;
  repoUrl: string;
  commitSha: string;
  code: string;
  language: "python" | "javascript" | "typescript";
  enqueuedAt: string;
  attemptCount: number;
  maxAttempts?: number;
}

export interface SqsMessageReceipt {
  messageId: string;
  receiptHandle: string;
  job: ClassroomSubmissionJob;
  attributes?: {
    approximateReceiveCount?: number;
    sentTimestamp?: string;
  };
}

export interface GradingResultPayload {
  submissionId: string;
  seriesId: string;
  studentHandle: string;
  status: AutoGraderStatus;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  gradedAt: string;
  workerPodId: string;
  secureSandbox: boolean;
}

export interface QueueMetrics {
  queueDepth: number; // Pending submissions in SQS
  messagesInFlight: number; // Submissions currently being processed
  dlqDepth: number; // Failed submissions in DLQ
  activeWorkerPods: number; // Active EKS worker pod count (0 - 50)
  spotNodesAllocated: number; // EC2 Spot instances provisioned
  targetWorkloadCapacity: number; // Designed for 500 simultaneous submissions
}
