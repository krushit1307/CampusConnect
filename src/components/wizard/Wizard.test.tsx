import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Wizard, type WizardStep } from "./Wizard";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  bio: z.string().optional(),
});

type Values = z.infer<typeof schema>;

const steps: WizardStep<Values>[] = [
  {
    id: "basic",
    title: "Basic Info",
    fields: ["name"],
    render: (form) => (
      <div>
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          value={form.getValues("name") ?? ""}
          onChange={(e) => form.setValue("name", e.target.value, { shouldDirty: true })}
        />
        {form.formState.errors.name && <span>{form.formState.errors.name.message}</span>}
      </div>
    ),
  },
  {
    id: "bio",
    title: "Bio",
    fields: ["bio"],
    render: (form) => (
      <div>
        <label htmlFor="bio">Bio</label>
        <input
          id="bio"
          value={form.getValues("bio") ?? ""}
          onChange={(e) => form.setValue("bio", e.target.value, { shouldDirty: true })}
        />
      </div>
    ),
  },
  {
    id: "review",
    title: "Review",
    fields: [],
    render: (form) => <p data-testid="review-name">{form.getValues("name")}</p>,
  },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function Harness({ initialPath = "/clubs/new" }: { initialPath?: string }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", bio: "" },
    mode: "onBlur",
  });

  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/clubs/new"
          element={
            <div>
              <Wizard
                form={form}
                steps={steps}
                storageKey="test-wizard"
                basePath="/clubs/new"
                submitLabel="Submit"
                onSubmitted={() => form.handleSubmit(() => {})()}
              />
              <LocationProbe />
            </div>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("Wizard (URL-bound multi-step)", () => {
  it("reads the step from the URL on mount", () => {
    sessionStorage.setItem("test-wizard", JSON.stringify({ name: "Alex Johnson" }));
    render(<Harness initialPath="/clubs/new?step=2" />);
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
    expect(screen.getByText("2. Bio")).toBeInTheDocument();
  });

  it("redirects back to step 1 when a later step is typed without prior data", () => {
    render(<Harness initialPath="/clubs/new?step=3" />);
    expect(screen.getByText("Basic Info")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("step=1");
  });

  it("updates the URL when advancing via Next", async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alex Johnson" } });
    fireEvent.click(screen.getByText("Next →"));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("step=2");
    });
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
  });

  it("blocks advancing when the current step fails validation", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("Next →"));

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
    expect(screen.getByTestId("location")).not.toHaveTextContent("step=2");
  });

  it("preserves typed data when navigating back to a previous step", async () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alex Johnson" } });
    fireEvent.click(screen.getByText("Next →"));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("step=2");
    });

    fireEvent.click(screen.getByText("Back"));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("step=1");
    });
    expect(screen.getByLabelText("Full name")).toHaveValue("Alex Johnson");
  });

  it("rehydrates cached data from sessionStorage on mount", async () => {
    sessionStorage.setItem("test-wizard", JSON.stringify({ name: "Alex Johnson", bio: "Hello" }));

    render(<Harness initialPath="/clubs/new?step=2" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Bio")).toHaveValue("Hello");
    });
  });

  it("reaches the review step and shows the cached name", async () => {
    sessionStorage.setItem("test-wizard", JSON.stringify({ name: "Alex Johnson", bio: "Hello" }));

    render(<Harness initialPath="/clubs/new?step=3" />);

    expect(screen.getByTestId("review-name")).toHaveTextContent("Alex Johnson");
  });
});
