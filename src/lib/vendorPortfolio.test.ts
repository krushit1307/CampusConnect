import { describe, expect, it } from "vitest";

import {
  MAX_VENDOR_AUDIO_EMBEDS,
  MAX_VENDOR_GALLERY_IMAGES,
  normalizeVendorPortfolio,
  toVendorAudioEmbedUrl,
} from "./vendorPortfolio";

describe("vendor portfolio validation", () => {
  it("converts only supported Spotify and SoundCloud URLs to embeds", () => {
    expect(toVendorAudioEmbedUrl("https://open.spotify.com/track/abc123")).toEqual({
      provider: "spotify",
      embedUrl: "https://open.spotify.com/embed/track/abc123",
    });
    expect(toVendorAudioEmbedUrl("https://soundcloud.com/student-dj/spring-set")).toMatchObject({
      provider: "soundcloud",
    });
    expect(toVendorAudioEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(toVendorAudioEmbedUrl("https://example.com/audio")).toBeNull();
  });

  it("normalizes malformed portfolio data and caps media counts", () => {
    const portfolio = normalizeVendorPortfolio({
      tagline: "A".repeat(200),
      specialties: ["DJ", "Photography", 42, ""],
      audio_embeds: Array.from({ length: MAX_VENDOR_AUDIO_EMBEDS + 2 }, (_, index) => ({
        provider: "spotify",
        url: `https://open.spotify.com/track/${index}`,
        embedUrl: `https://open.spotify.com/embed/track/${index}`,
      })),
      gallery: Array.from({ length: MAX_VENDOR_GALLERY_IMAGES + 2 }, (_, index) => ({
        url: `https://cdn.example.test/${index}.jpg`,
        alt: `Image ${index}`,
      })),
    });
    expect(portfolio.tagline).toHaveLength(160);
    expect(portfolio.specialties).toEqual(["DJ", "Photography"]);
    expect(portfolio.audio_embeds).toHaveLength(MAX_VENDOR_AUDIO_EMBEDS);
    expect(portfolio.gallery).toHaveLength(MAX_VENDOR_GALLERY_IMAGES);
  });

  it("rejects non-HTTPS gallery URLs and untrusted stored iframe sources", () => {
    expect(
      normalizeVendorPortfolio({
        gallery: [{ url: "http://unsafe.example/image.jpg", alt: "unsafe" }],
      }).gallery,
    ).toEqual([]);
    expect(
      normalizeVendorPortfolio({
        audio_embeds: [
          {
            provider: "spotify",
            url: "https://open.spotify.com/track/valid123",
            embedUrl: "https://attacker.example/embed",
          },
        ],
      }).audio_embeds,
    ).toEqual([
      {
        provider: "spotify",
        url: "https://open.spotify.com/track/valid123",
        embedUrl: "https://open.spotify.com/embed/track/valid123",
      },
    ]);
  });
});
