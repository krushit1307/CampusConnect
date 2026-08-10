export type AssetableType = "USER" | "EVENT" | "CLUB";

export interface MediaAssetInput {
  file_url: string;
  size_bytes?: number;
  mime_type?: string;
  assetable_type: AssetableType;
  assetable_id: string;
}

export interface MediaAssetRecord extends MediaAssetInput {
  id: string;
  created_at: string;
}

/**
 * Builds a valid MediaAsset record payload for polymorphic tracking.
 */
export function buildMediaAssetPayload(input: MediaAssetInput): MediaAssetInput {
  const allowedTypes: AssetableType[] = ["USER", "EVENT", "CLUB"];
  if (!allowedTypes.includes(input.assetable_type)) {
    throw new Error(`Invalid assetable_type: ${input.assetable_type}`);
  }

  return {
    file_url: input.file_url,
    size_bytes: input.size_bytes ?? 0,
    mime_type: input.mime_type ?? "image/jpeg",
    assetable_type: input.assetable_type,
    assetable_id: input.assetable_id,
  };
}
