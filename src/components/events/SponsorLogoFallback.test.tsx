import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getSponsorLogoGradient, getSponsorLogoInitial } from "@/lib/sponsorLogo";
import { SponsorLogoFallback } from "./SponsorLogoFallback";

describe("SponsorLogoFallback", () => {
  it("derives a stable initial and gradient from the sponsor name", () => {
    expect(getSponsorLogoInitial("  acme labs ")).toBe("A");
    expect(getSponsorLogoGradient("Acme Labs")).toBe(getSponsorLogoGradient("acme labs"));
    expect(getSponsorLogoGradient("Acme Labs")).toMatch(/^linear-gradient\(135deg,/);
  });

  it("renders the typographic fallback immediately when no logo URL exists", () => {
    render(<SponsorLogoFallback name="Acme Labs" />);

    expect(screen.getByTestId("sponsor-logo-fallback")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Acme Labs logo" })).toHaveTextContent("A");
  });

  it("replaces a failed image without leaving a broken image icon", () => {
    render(<SponsorLogoFallback name="Northstar" src="https://example.com/northstar.png" />);

    const image = screen.getByRole("img", { name: "Northstar logo" });
    fireEvent.error(image);

    expect(screen.queryByRole("img", { name: "Northstar logo" })).toHaveAttribute(
      "data-testid",
      "sponsor-logo-fallback",
    );
    expect(screen.getByTestId("sponsor-logo-fallback")).toHaveTextContent("N");
  });

  it("keeps the caller-provided wrapper dimensions on fallback", () => {
    render(
      <SponsorLogoFallback
        name="Acme Labs"
        className="h-40 w-full"
        src="https://example.com/broken.png"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Acme Labs logo" }));

    expect(screen.getByTestId("sponsor-logo-fallback")).toHaveClass("h-40", "w-full");
  });
});
