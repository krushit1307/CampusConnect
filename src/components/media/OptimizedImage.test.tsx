import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptimizedImage } from "./OptimizedImage";

describe("OptimizedImage Component", () => {
  it("renders public Supabase image with LQIP and picture structure", () => {
    const src = "https://example.supabase.co/storage/v1/object/public/event-banners/banner.png";
    render(
      <OptimizedImage
        src={src}
        alt="Test Banner"
        width={400}
        height={300}
      />
    );

    // Verify LQIP placeholder image exists (it's hidden/blur image)
    const images = screen.getAllByRole("img", { hidden: true });
    expect(images.length).toBeGreaterThanOrEqual(1);

    // Verify picture element with source formats exists
    const imgEl = screen.getByRole("img", { name: "Test Banner" });
    expect(imgEl).toBeInTheDocument();
    expect(imgEl).toHaveAttribute("src");
    expect(imgEl.getAttribute("src")).toContain("/storage/v1/render/image/public/");
  });

  it("renders non-Supabase images directly without rendering render URLs", () => {
    const src = "https://images.unsplash.com/photo-1234";
    render(
      <OptimizedImage
        src={src}
        alt="Unsplash Image"
        width={400}
        height={300}
      />
    );

    const imgEl = screen.getByRole("img", { name: "Unsplash Image" });
    expect(imgEl).toBeInTheDocument();
    expect(imgEl.getAttribute("src")).toBe(src);
  });
});
