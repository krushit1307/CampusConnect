import { describe, it, expect } from "vitest";
import { buildMediaAssetPayload, AssetableType } from "./mediaAssets";

describe("Polymorphic Media Assets Suite (#2204)", () => {
  it("constructs a valid USER media asset payload", () => {
    const payload = buildMediaAssetPayload({
      file_url: "https://example.com/avatar.jpg",
      size_bytes: 204800,
      mime_type: "image/jpeg",
      assetable_type: "USER",
      assetable_id: "123e4567-e89b-12d3-a456-426614174000",
    });

    expect(payload.assetable_type).toBe("USER");
    expect(payload.file_url).toBe("https://example.com/avatar.jpg");
    expect(payload.size_bytes).toBe(204800);
  });

  it("constructs a valid EVENT media asset payload with default fallback values", () => {
    const payload = buildMediaAssetPayload({
      file_url: "https://example.com/banner.png",
      assetable_type: "EVENT",
      assetable_id: "987e6543-e21b-12d3-a456-426614174000",
    });

    expect(payload.assetable_type).toBe("EVENT");
    expect(payload.size_bytes).toBe(0);
    expect(payload.mime_type).toBe("image/jpeg");
  });

  it("rejects invalid assetable types", () => {
    expect(() =>
      buildMediaAssetPayload({
        file_url: "https://example.com/file.png",
        assetable_type: "INVALID_TYPE" as AssetableType,
        assetable_id: "123e4567-e89b-12d3-a456-426614174000",
      }),
    ).toThrow("Invalid assetable_type: INVALID_TYPE");
  });
});
