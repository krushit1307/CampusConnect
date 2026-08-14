import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AlumniJobBoardTab } from "./AlumniJobBoardTab";
import { ClubJobPosting } from "@/lib/alumniJobBoard";

describe("AlumniJobBoardTab Component (#2992)", () => {
  const sampleJobs: ClubJobPosting[] = [
    {
      id: "job-1",
      club_id: "club-tech",
      alumni_user_id: "alumni-1",
      title: "Frontend Developer",
      company: "Stripe",
      company_domain: "stripe.com",
      description: "Join Stripe's frontend team to build developer payments",
      location: "San Francisco, CA",
      job_type: "Full-time",
      apply_url: "https://stripe.com/jobs/1",
      expires_at: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days remaining
      created_at: new Date().toISOString(),
    },
    {
      id: "job-2",
      club_id: "club-tech",
      alumni_user_id: "alumni-2",
      title: "AI Research Intern",
      company: "OpenAI",
      company_domain: "openai.com",
      description: "Summer AI internship working on LLMs",
      location: "Remote",
      job_type: "Internship",
      apply_url: "https://openai.com/jobs/2",
      expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  it("renders locked state banner for non-club members", () => {
    render(<AlumniJobBoardTab clubId="club-tech" isMember={false} />);

    expect(screen.getByTestId("job-board-locked")).toBeInTheDocument();
    expect(screen.getByText(/Exclusive Alumni Opportunities/i)).toBeInTheDocument();
    expect(screen.queryByText("Frontend Developer")).not.toBeInTheDocument();
  });

  it("renders job postings list for active club members", () => {
    render(<AlumniJobBoardTab clubId="club-tech" isMember={true} postings={sampleJobs} />);

    expect(screen.getByText(/Alumni Job Board/i)).toBeInTheDocument();
    expect(screen.getByText("Frontend Developer")).toBeInTheDocument();
    expect(screen.getByText("AI Research Intern")).toBeInTheDocument();
    expect(screen.getByText(/20 days remaining/i)).toBeInTheDocument();
  });

  it("filters job postings by Internship type", () => {
    render(<AlumniJobBoardTab clubId="club-tech" isMember={true} postings={sampleJobs} />);

    const internshipBtn = screen.getByRole("button", { name: /^internship$/i });
    fireEvent.click(internshipBtn);

    expect(screen.getByText("AI Research Intern")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Developer")).not.toBeInTheDocument();
  });

  it("allows club leaders to delete/moderate job postings", () => {
    const handleDelete = vi.fn();
    render(
      <AlumniJobBoardTab
        clubId="club-tech"
        isMember={true}
        isAlumniOrLeader={true}
        postings={sampleJobs}
        onDeletePosting={handleDelete}
      />
    );

    const deleteButtons = screen.getAllByTitle(/Delete\/Moderate posting/i);
    fireEvent.click(deleteButtons[0]);

    expect(handleDelete).toHaveBeenCalledWith("job-1");
  });
});
