import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillMatcherWidget } from "./SkillMatcherWidget";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "recruiter-1" } }, error: null }),
      },
      from: () => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
});

describe("SkillMatcherWidget", () => {
  it("renders recruiter form with JD upload inputs", () => {
    render(<SkillMatcherWidget userRole="recruiter" sponsorId="sp-1" companyName="Google" />);

    expect(screen.getByTestId("skill-matcher-widget")).toBeInTheDocument();
    expect(screen.getByTestId("jd-title-input")).toBeInTheDocument();
    expect(screen.getByTestId("jd-desc-input")).toBeInTheDocument();
    expect(screen.getByTestId("jd-skills-input")).toBeInTheDocument();
    expect(screen.getByTestId("upload-jd-btn")).toBeInTheDocument();
  });

  it("renders student form with matching query button", () => {
    render(<SkillMatcherWidget userRole="student" />);

    expect(screen.getByTestId("skill-matcher-widget")).toBeInTheDocument();
    expect(screen.getByTestId("student-skills-input")).toBeInTheDocument();
    expect(screen.getByTestId("match-skills-btn")).toBeInTheDocument();
  });
});
