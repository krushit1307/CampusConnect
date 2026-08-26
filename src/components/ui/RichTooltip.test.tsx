import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { RichTooltip } from "./RichTooltip";
import { ProfileCard } from "./ProfileCard";
import {
  DateTooltipContent,
  LocationTooltipContent,
  InfoTooltipContent,
  StatusTooltipContent,
} from "./RichTooltipContent";

/**
 * Wraps children with the Radix TooltipProvider required for tooltips to function.
 */
function Wrapper({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={0}>{children}</TooltipPrimitive.Provider>;
}

describe("RichTooltip Component (#1758)", () => {
  it("renders the trigger element", () => {
    render(
      <Wrapper>
        <RichTooltip content={<span>Tooltip content</span>}>
          <button>Hover me</button>
        </RichTooltip>
      </Wrapper>,
    );

    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });

  it("renders children directly when content is falsy", () => {
    render(
      <Wrapper>
        <RichTooltip content={null as unknown as React.ReactNode}>
          <button>No tooltip</button>
        </RichTooltip>
      </Wrapper>,
    );

    expect(screen.getByText("No tooltip")).toBeInTheDocument();
  });

  it("trigger element is focusable for keyboard accessibility", () => {
    render(
      <Wrapper>
        <RichTooltip content={<span>Accessible</span>}>
          <button>Focus me</button>
        </RichTooltip>
      </Wrapper>,
    );

    const trigger = screen.getByText("Focus me");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("ProfileCard Component (#1758)", () => {
  it("renders user name and role badge", () => {
    render(<ProfileCard name="Dipanshu Batra" role="Admin" />);

    expect(screen.getByText("Dipanshu Batra")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders fallback initials when no avatar URL is provided", () => {
    render(<ProfileCard name="Dipanshu Batra" />);

    expect(screen.getByText("DB")).toBeInTheDocument();
  });

  it("renders avatar image when avatarUrl is provided", () => {
    render(<ProfileCard name="Alex Rivera" avatarUrl="https://example.com/avatar.jpg" />);

    const img = screen.getByAltText("Alex Rivera");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("renders bio and department when provided", () => {
    render(
      <ProfileCard
        name="Test User"
        bio="Full-stack developer and open source contributor."
        department="Computer Science & Engineering"
      />,
    );

    expect(
      screen.getByText("Full-stack developer and open source contributor."),
    ).toBeInTheDocument();
    expect(screen.getByText("Computer Science & Engineering")).toBeInTheDocument();
  });

  it("renders single initial for single-name users", () => {
    render(<ProfileCard name="Krushit" />);
    expect(screen.getByText("K")).toBeInTheDocument();
  });
});

describe("Rich Tooltip Content Variants (#1758)", () => {
  it("DateTooltipContent renders full date and relative time", () => {
    render(
      <DateTooltipContent
        fullDate="October 15, 2026 at 2:30 PM"
        relativeTime="in 3 days"
        timezone="IST (UTC+5:30)"
      />,
    );

    expect(screen.getByText("October 15, 2026 at 2:30 PM")).toBeInTheDocument();
    expect(screen.getByText("in 3 days")).toBeInTheDocument();
    expect(screen.getByText("Timezone: IST (UTC+5:30)")).toBeInTheDocument();
  });

  it("DateTooltipContent renders without optional fields", () => {
    render(<DateTooltipContent fullDate="January 1, 2026" />);
    expect(screen.getByText("January 1, 2026")).toBeInTheDocument();
  });

  it("LocationTooltipContent renders venue and address", () => {
    render(
      <LocationTooltipContent
        venue="Main Auditorium"
        address="Thapar Institute, Patiala, Punjab"
        mapsUrl="https://maps.google.com"
      />,
    );

    expect(screen.getByText("Main Auditorium")).toBeInTheDocument();
    expect(screen.getByText("Thapar Institute, Patiala, Punjab")).toBeInTheDocument();
    expect(screen.getByText("Open in Maps")).toBeInTheDocument();
  });

  it("LocationTooltipContent renders without optional address and maps", () => {
    render(<LocationTooltipContent venue="Room 402" />);
    expect(screen.getByText("Room 402")).toBeInTheDocument();
  });

  it("InfoTooltipContent renders title and description", () => {
    render(
      <InfoTooltipContent
        title="What is RSVP?"
        description="Reserve your spot by clicking the RSVP button below."
      />,
    );

    expect(screen.getByText("What is RSVP?")).toBeInTheDocument();
    expect(
      screen.getByText("Reserve your spot by clicking the RSVP button below."),
    ).toBeInTheDocument();
  });

  it("InfoTooltipContent renders warning variant", () => {
    render(
      <InfoTooltipContent
        title="Limited Capacity"
        description="This event has only 5 seats remaining."
        variant="warning"
      />,
    );

    expect(screen.getByText("Limited Capacity")).toBeInTheDocument();
    expect(screen.getByText("This event has only 5 seats remaining.")).toBeInTheDocument();
  });

  it("StatusTooltipContent renders status with explanation", () => {
    render(
      <StatusTooltipContent
        status="Approved"
        statusColor="bg-green-500"
        explanation="Your RSVP has been confirmed by the organizer."
      />,
    );

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Your RSVP has been confirmed by the organizer.")).toBeInTheDocument();
  });

  it("StatusTooltipContent renders without explanation", () => {
    render(<StatusTooltipContent status="Pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});
