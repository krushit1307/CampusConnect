import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClassroomDependencyAuditor } from "../components/Clubs/ClassroomDependencyAuditor";
import { ClassroomAuditorService } from "../services/classroomAuditorService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  },
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: (msg: string) => mockToastSuccess(msg),
    info: (msg: string) => mockToastInfo(msg),
  },
}));

// Mock ClassroomAuditorService
vi.mock("../services/classroomAuditorService", () => {
  return {
    ClassroomAuditorService: {
      fetchAssignmentsForSeries: vi.fn(),
      fetchSubmissionsForAssignment: vi.fn(),
      fetchAuditLogsForSubmission: vi.fn(),
      createAssignment: vi.fn(),
      runDependencyAudit: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("ClassroomDependencyAuditor Component", () => {
  const dummyAssignments = [
    {
      id: "assignment-1",
      series_id: "series-1",
      title: "Lab 1: Express REST API",
      github_org: "cc-classroom",
      github_repo_prefix: "lab-1-express",
      created_at: new Date().toISOString(),
    },
  ];

  const dummySubmissions = [
    {
      id: "sub-1",
      assignment_id: "assignment-1",
      student_id: "student-1",
      github_repo_name: "lab-1-express-stud1",
      pr_number: 1,
      commit_sha: "commitsha123",
      audit_status: "PENDING",
      vulnerabilities_found: [],
      autograding_score: null,
      updated_at: new Date().toISOString(),
      profiles: {
        full_name: "Student One",
        handle: "stud1",
      },
    },
  ];

  const dummyLogs = [
    {
      id: "log-1",
      submission_id: "sub-1",
      package_name: "express",
      current_version: "4.16.0",
      cve_id: "CVE-2022-XYZ",
      cvss_score: 7.5,
      patched_version: "4.18.2",
      summary: "Prototype pollution in express server",
      audited_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ClassroomAuditorService.fetchAssignmentsForSeries).mockResolvedValue(dummyAssignments);
    vi.mocked(ClassroomAuditorService.fetchSubmissionsForAssignment).mockResolvedValue(dummySubmissions);
    vi.mocked(ClassroomAuditorService.fetchAuditLogsForSubmission).mockResolvedValue(dummyLogs);
  });

  it("renders assignments, student submissions table, and CVE logs", async () => {
    render(<ClassroomDependencyAuditor seriesId="series-1" />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByTestId("classroom-dependency-auditor")).toBeInTheDocument();
    });

    expect(screen.getByText("Lab 1: Express REST API (cc-classroom/lab-1-express)")).toBeInTheDocument();
    expect(screen.getByText("Student One")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("registers new assignments and shows success notification", async () => {
    vi.mocked(ClassroomAuditorService.createAssignment).mockResolvedValue({
      id: "assignment-2",
      series_id: "series-1",
      title: "Lab 2: React State",
      github_org: "cc-classroom",
      github_repo_prefix: "lab-2-react",
      created_at: new Date().toISOString(),
    });

    render(<ClassroomDependencyAuditor seriesId="series-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("classroom-dependency-auditor")).toBeInTheDocument();
    });

    // Toggle registration form
    const toggleFormBtn = screen.getByTestId("toggle-assign-form-btn");
    fireEvent.click(toggleFormBtn);

    // Input details
    const titleInput = screen.getByTestId("new-title-input");
    fireEvent.change(titleInput, { target: { value: "Lab 2: React State" } });

    // Submit
    const submitBtn = screen.getByTestId("submit-assignment-btn");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ClassroomAuditorService.createAssignment).toHaveBeenCalledWith(
        "series-1",
        "Lab 2: React State",
        "cc-classroom",
        "lab-"
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Assignment registered successfully")
      );
    });
  });

  it("triggers mock dependency audit and shows detailed reports", async () => {
    vi.mocked(ClassroomAuditorService.runDependencyAudit).mockResolvedValue({
      success: true,
      audit_status: "FAILED",
      vulnerabilities: dummyLogs,
    });

    render(<ClassroomDependencyAuditor seriesId="series-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("classroom-dependency-auditor")).toBeInTheDocument();
    });

    // Select row
    const row = screen.getByTestId("submission-row-sub-1");
    fireEvent.click(row);

    // Fill manifest input
    await waitFor(() => {
      expect(screen.getByTestId("manifest-input")).toBeInTheDocument();
    });
    const manifestInput = screen.getByTestId("manifest-input");
    fireEvent.change(manifestInput, { target: { value: '{"dependencies": {"express": "4.16.0"}}' } });

    // Run audit
    const runBtn = screen.getByTestId("run-audit-btn");
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(ClassroomAuditorService.runDependencyAudit).toHaveBeenCalledWith(
        "sub-1",
        '{"dependencies": {"express": "4.16.0"}}',
        "json"
      );
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Dependency Audit FAILED: High CVSS score vulnerability detected")
      );
    });
  });
});
