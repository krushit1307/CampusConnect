import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventForm } from "./EventForm";
import userEvent from "@testing-library/user-event";

// Mock @hello-pangea/dnd for field array testing
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: any) => <div>{children}</div>,
  Droppable: ({ children }: any) =>
    children(
      {
        droppableProps: {},
        innerRef: vi.fn(),
        placeholder: null,
      },
      {},
    ),
  Draggable: ({ children }: any) =>
    children(
      {
        draggableProps: {},
        dragHandleProps: {},
        innerRef: vi.fn(),
      },
      { isDragging: false },
    ),
}));

describe("EventForm with FormContext (#1733)", () => {
  it("renders basic details, location, and ticket tier sections without prop-drilling", () => {
    render(<EventForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/Event Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Location/i)).toBeInTheDocument();
    expect(screen.getByText(/Ticket Tiers & Pricing/i)).toBeInTheDocument();
  });

  it("allows typing into basic details and location inputs via useFormContext", async () => {
    const user = userEvent.setup();
    render(<EventForm onSubmit={vi.fn()} />);

    const titleInput = screen.getByLabelText(/Event Title/i);
    const descriptionInput = screen.getByLabelText(/Description/i);
    const locationInput = screen.getByLabelText(/Location/i);

    await user.type(titleInput, "Campus Hackathon 2026");
    await user.type(descriptionInput, "Annual hackathon featuring AI and web challenges!");
    await user.type(locationInput, "Student Center Main Hall");

    expect(titleInput).toHaveValue("Campus Hackathon 2026");
    expect(descriptionInput).toHaveValue("Annual hackathon featuring AI and web challenges!");
    expect(locationInput).toHaveValue("Student Center Main Hall");
  });

  it("adds and updates a ticket tier using useFormContext without prop-drilling", async () => {
    const user = userEvent.setup();
    render(<EventForm onSubmit={vi.fn()} />);

    const addTierBtn = screen.getByRole("button", { name: /Add Ticket Tier/i });
    await user.click(addTierBtn);

    const nameInput = screen.getByPlaceholderText(/Early Bird, General Admission/i);
    const priceInput = screen.getByPlaceholderText("0.00");
    const capacityInput = screen.getByPlaceholderText("100");

    await user.type(nameInput, "VIP Pass");
    await user.clear(priceInput);
    await user.type(priceInput, "49.99");
    await user.clear(capacityInput);
    await user.type(capacityInput, "50");

    expect(nameInput).toHaveValue("VIP Pass");
    expect(priceInput).toHaveValue(49.99);
    expect(capacityInput).toHaveValue(50);
  });

  it("submits aggregated state to onSubmit callback when form is valid", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const futureStartDate = new Date(Date.now() + 86400000); // Tomorrow
    const futureEndDate = new Date(Date.now() + 172800000); // 2 days from now

    render(
      <EventForm
        onSubmit={handleSubmit}
        defaultValues={{
          title: "Design Summit 2026",
          description: "Explore future trends in UX, UI, and Product Design across campus.",
          location: "Auditorium A",
          startDate: futureStartDate,
          endDate: futureEndDate,
          tickets: [
            {
              name: "General Access",
              price: 15,
              capacity: 200,
              description: "Standard ticket",
              isEarlyBird: false,
              isActive: true,
            },
          ],
        }}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /Save Event/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Design Summit 2026",
          description: "Explore future trends in UX, UI, and Product Design across campus.",
          location: "Auditorium A",
          tickets: [
            expect.objectContaining({
              name: "General Access",
              price: 15,
              capacity: 200,
            }),
          ],
        }),
      );
    });
  });
});
