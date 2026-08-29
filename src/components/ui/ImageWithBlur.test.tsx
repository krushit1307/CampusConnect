import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ImageWithBlur } from "./ImageWithBlur";

// Mock react-blurhash component for unit testing
vi.mock("react-blurhash", () => ({
  Blurhash: ({ hash }: { hash: string }) => (
    <div data-testid="mock-blurhash-canvas" data-hash={hash}>
      Blurhash Placeholder Canvas ({hash})
    </div>
  ),
}));

describe("ImageWithBlur Component", () => {
  const sampleProps = {
    src: "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
    alt: "Campus Tech Summit 2026",
    blurhash: "LKO2?_%g~q_3t7t7Rjwb_3%M%MWB",
  };

  it("renders container and Blurhash canvas initially with opacity-0 image", () => {
    render(<ImageWithBlur {...sampleProps} />);

    expect(screen.getByTestId("image-blur-container")).toBeInTheDocument();
    expect(screen.getByTestId("mock-blurhash-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("mock-blurhash-canvas")).toHaveAttribute(
      "data-hash",
      sampleProps.blurhash,
    );

    const imgElement = screen.getByAltText(sampleProps.alt);
    expect(imgElement).toBeInTheDocument();
    expect(imgElement).toHaveClass("opacity-0");
  });

  it("transitions image to opacity-100 when onLoad fires", () => {
    render(<ImageWithBlur {...sampleProps} />);

    const imgElement = screen.getByAltText(sampleProps.alt);
    expect(imgElement).toHaveClass("opacity-0");

    fireEvent.load(imgElement);

    expect(imgElement).toHaveClass("opacity-100");
    expect(screen.queryByTestId("mock-blurhash-canvas")).not.toBeInTheDocument();
  });

  it("renders error fallback state when image fails to load", () => {
    render(<ImageWithBlur {...sampleProps} src="invalid-image-url.png" />);

    const imgElement = screen.getByAltText(sampleProps.alt);
    fireEvent.error(imgElement);

    expect(screen.getByTestId("image-error-fallback")).toBeInTheDocument();
    expect(screen.getByText(/Failed to load image/i)).toBeInTheDocument();
  });

  it("applies strict aspect ratio wrapper classes", () => {
    const { rerender } = render(<ImageWithBlur {...sampleProps} aspectRatio="video" />);
    expect(screen.getByTestId("image-blur-container")).toHaveClass("aspect-video");

    rerender(<ImageWithBlur {...sampleProps} aspectRatio="square" />);
    expect(screen.getByTestId("image-blur-container")).toHaveClass("aspect-square");
  });

  it("uses default fallback Blurhash when invalid Blurhash is provided", () => {
    // Use a string with chars outside base83 (space is not in base83)
    render(<ImageWithBlur {...sampleProps} blurhash="inv alid!" />);

    expect(screen.getByTestId("mock-blurhash-canvas")).toHaveAttribute(
      "data-hash",
      "LKO2?_%g~q_3t7t7Rjwb_3%M%MWB",
    );
  });

  it("generates responsive srcset and applies sizes for Supabase public images", () => {
    const supabaseSrc =
      "https://example.supabase.co/storage/v1/object/public/event-banners/banner.png";
    render(
      <ImageWithBlur
        src={supabaseSrc}
        alt="Supabase Event"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        responsiveWidths={[300, 600, 1200]}
      />,
    );

    const imgElement = screen.getByAltText("Supabase Event");
    expect(imgElement).toBeInTheDocument();
    expect(imgElement).toHaveAttribute("srcset");
    expect(imgElement.getAttribute("srcset")).toContain("300w");
    expect(imgElement.getAttribute("srcset")).toContain("600w");
    expect(imgElement.getAttribute("srcset")).toContain("1200w");
    expect(imgElement.getAttribute("sizes")).toBe(
      "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
    );
  });
});
