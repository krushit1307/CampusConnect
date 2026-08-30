import React from "react";
import { ProcessedPhotoAsset } from "../../types/photoWatermarking";

interface PhotoVaultArchiveGalleryProps {
  assets: ProcessedPhotoAsset[];
  isClubOfficer: boolean;
  onDownloadOriginal?: (asset: ProcessedPhotoAsset) => void;
}

export const PhotoVaultArchiveGallery: React.FC<PhotoVaultArchiveGalleryProps> = ({
  assets,
  isClubOfficer,
  onDownloadOriginal,
}) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Event Photo Protection Gallery</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Public viewers receive watermarked assets with copyright protection. Officers have
            access to raw archive masters.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {assets.length} Assets Protected
        </span>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          No photo assets processed yet for this event.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="overflow-hidden rounded-xl border border-border bg-muted/20 hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="relative aspect-video bg-black/5">
                <img
                  src={asset.publicWatermarkedUrl}
                  alt={asset.originalFileName}
                  className="h-full w-full object-cover"
                />
                <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                  Public © Watermarked
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-foreground truncate">
                    {asset.originalFileName}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {asset.watermarkMetadata.copyrightText}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <a
                    href={asset.publicWatermarkedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    View Public →
                  </a>

                  {isClubOfficer ? (
                    <button
                      onClick={() => onDownloadOriginal?.(asset)}
                      className="rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground hover:bg-secondary/80"
                    >
                      📥 Archive Master
                    </button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      Master Vault Locked 🔒
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
