import { describe, expect, it } from "vitest";
import {
  buildResponsiveImageSrcSet,
  getOptimizedImageUrl,
  isSupabasePublicImage,
} from "@/lib/imageOptimization";

const supabaseImage =
  "https://example.supabase.co/storage/v1/object/public/event-banners/banner.png";

describe("image optimization helpers", () => {
  it("recognizes public Supabase Storage images", () => {
    expect(isSupabasePublicImage(supabaseImage)).toBe(true);
    expect(isSupabasePublicImage("https://images.example.com/banner.png")).toBe(false);
  });

  it("converts public storage URLs to render URLs with transforms", () => {
    const result = getOptimizedImageUrl(supabaseImage, {
      width: 896,
      height: 320,
      quality: 80,
      resize: "cover",
    });

    expect(result).toContain("/functions/v1/image");
    expect(result).toContain("file=event-banners%2Fbanner.png");
    expect(result).toContain("width=896");
  });

  it("leaves non-Supabase URLs unchanged", () => {
    const source = "blob:http://localhost/avatar-preview";
    expect(getOptimizedImageUrl(source, { width: 96 })).toBe(source);
  });

  it("handles image format transformations correctly (ignored in URL, handled by Accept header)", () => {
    const result = getOptimizedImageUrl(supabaseImage, {
      width: 800,
    });
    expect(result).toContain("/functions/v1/image");
    expect(result).toContain("width=800");
  });

  it("builds a sorted responsive srcset without duplicate widths", () => {
    const srcSet = buildResponsiveImageSrcSet(supabaseImage, [896, 448, 896]);

    expect(srcSet).toContain("448w");
    expect(srcSet).toContain("896w");
    expect(srcSet?.match(/896w/g)).toHaveLength(1);
  });

  it("builds responsive srcset using DEFAULT_RESPONSIVE_WIDTHS when widths not provided", () => {
    const srcSet = buildResponsiveImageSrcSet(supabaseImage);

    expect(srcSet).toContain("300w");
    expect(srcSet).toContain("600w");
    expect(srcSet).toContain("1200w");
  });
});
