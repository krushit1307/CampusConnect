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

    expect(result).toContain("/storage/v1/render/image/public/");
    expect(result).toContain("width=896");
    expect(result).toContain("height=320");
    expect(result).toContain("quality=80");
    expect(result).toContain("resize=cover");
  });

  it("leaves non-Supabase URLs unchanged", () => {
    const source = "blob:http://localhost/avatar-preview";
    expect(getOptimizedImageUrl(source, { width: 96 })).toBe(source);
  });

  it("builds a sorted responsive srcset without duplicate widths", () => {
    const srcSet = buildResponsiveImageSrcSet(supabaseImage, [896, 448, 896]);

    expect(srcSet).toContain("448w");
    expect(srcSet).toContain("896w");
    expect(srcSet?.match(/896w/g)).toHaveLength(1);
  });
});
