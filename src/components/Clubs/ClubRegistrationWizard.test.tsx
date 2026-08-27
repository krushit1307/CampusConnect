import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClubRegistrationWizard, SESSION_STORAGE_KEY } from "./ClubRegistrationWizard";

// Mock CascadingCategorySelect & MarkdownEditor for unit tests
vi.mock("./CascadingCategorySelect", () => ({
  CascadingCategorySelect: ({ value, onChange }: { value: string | null; onChange: (val: string) => void }) => (
    <select
      data-testid="category-select"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select category</option>
      <option value="cat-tech">Tech & AI</option>
      <option value="cat-arts">Arts & Music</option>
    </select>
  ),
}));

vi.mock("@/components/MarkdownEditor", () => ({
  MarkdownEditor: ({ value, onChange, placeholder }: { value: string; onChange: (val: string) => void; placeholder: string }) => (
    <textarea
      data-testid="markdown-editor"
      placeholder={placeholder}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("ClubRegistrationWizard Component (#1742)", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders Step 1 initially and advances to Step 2 when Step 1 fields are valid", async () => {
    render(<ClubRegistrationWizard />);

    expect(screen.getByRole("heading", { name: /1. Basic Club Details/i })).toBeInTheDocument();

    // Fill Step 1 required fields
    fireEvent.change(screen.getByPlaceholderText(/AI Research Society/i), { target: { value: "Robotics Club" } });
    fireEvent.change(screen.getByPlaceholderText(/ai-research-society/i), { target: { value: "robotics-club" } });
    fireEvent.change(screen.getByTestId("category-select"), { target: { value: "cat-tech" } });
    fireEvent.change(screen.getByPlaceholderText(/Empowering campus innovators/i), {
      target: { value: "Building the future of robotics" },
    });

    // Click Next
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /2. Contact & Social Links/i })).toBeInTheDocument();
    });
  });

  it("blocks progression from Step 2 if required contact email is invalid or blank", async () => {
    render(<ClubRegistrationWizard />);

    // Step 1
    fireEvent.change(screen.getByPlaceholderText(/AI Research Society/i), { target: { value: "Robotics Club" } });
    fireEvent.change(screen.getByPlaceholderText(/ai-research-society/i), { target: { value: "robotics-club" } });
    fireEvent.change(screen.getByTestId("category-select"), { target: { value: "cat-tech" } });
    fireEvent.change(screen.getByPlaceholderText(/Empowering campus innovators/i), {
      target: { value: "Building the future of robotics" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Next/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /2. Contact & Social Links/i })).toBeInTheDocument();
    });

    // Leave Step 2 email blank and click Next
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));

    await waitFor(() => {
      // Must remain on Step 2 with validation error
      expect(screen.getByText(/Please enter a valid contact email/i)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /3. Faculty Advisor Details/i })).not.toBeInTheDocument();
    });
  });

  it("aggregates data across all 4 steps and submits complete payload", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ClubRegistrationWizard onSubmit={handleSubmit} />);

    // Step 1
    fireEvent.change(screen.getByPlaceholderText(/AI Research Society/i), { target: { value: "Robotics Club" } });
    fireEvent.change(screen.getByPlaceholderText(/ai-research-society/i), { target: { value: "robotics-club" } });
    fireEvent.change(screen.getByTestId("category-select"), { target: { value: "cat-tech" } });
    fireEvent.change(screen.getByPlaceholderText(/Empowering campus innovators/i), {
      target: { value: "Building the future of robotics" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));

    // Step 2
    await waitFor(() => expect(screen.getByRole("heading", { name: /2. Contact & Social Links/i })).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/contact@aisociety.edu/i), { target: { value: "info@robotics.edu" } });
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));

    // Step 3
    await waitFor(() => expect(screen.getByRole("heading", { name: /3. Faculty Advisor Details/i })).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Dr. Alan Turing/i), { target: { value: "Dr. Grace Hopper" } });
    fireEvent.change(screen.getByPlaceholderText(/turing@cs.campus.edu/i), { target: { value: "grace@cs.edu" } });
    fireEvent.change(screen.getByPlaceholderText(/Computer Science & Engineering/i), { target: { value: "Computer Science" } });
    fireEvent.change(screen.getByPlaceholderText(/Associate Professor/i), { target: { value: "Professor" } });
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));

    // Step 4
    await waitFor(() => expect(screen.getByRole("heading", { name: /4. Constitution & Charter Agreement/i })).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("markdown-editor"), {
      target: { value: "Article I: Name & Purpose of the Robotics Club. Members shall build robots and compete in annual robotics matches." },
    });
    fireEvent.change(screen.getByPlaceholderText(/We hereby request official recognition/i), {
      target: { value: "We hereby request official recognition as an active campus club." },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /Submit Club Registration/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Robotics Club",
          slug: "robotics-club",
          contact_email: "info@robotics.edu",
          advisor_name: "Dr. Grace Hopper",
          advisor_email: "grace@cs.edu",
          charter_statement: "We hereby request official recognition as an active campus club.",
          member_agreement: true,
        }),
      );
    });
  });

  it("persists form input to sessionStorage and rehydrates on mount", async () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ name: "Cached Chess Club", tagline: "Mind games on campus" }),
    );

    render(<ClubRegistrationWizard />);

    expect(screen.getByPlaceholderText(/AI Research Society/i)).toHaveValue("Cached Chess Club");
    expect(screen.getByPlaceholderText(/Empowering campus innovators/i)).toHaveValue("Mind games on campus");
  });
});
