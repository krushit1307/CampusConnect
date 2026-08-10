import React, { useState } from "react";
import { ImageCropperModal } from "./ImageCropperModal";
import { convertHeicIfNeeded } from "../../utils/imageUtils";

interface ImageUploadProps {
  label?: string;
  aspectRatio?: number; // 1 for avatar, 16/9 for banner
  onImageCropped: (croppedBlob: Blob) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  label = "Upload Image",
  aspectRatio = 1,
  onImageCropped,
}) => {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Convert HEIC if needed (iOS edge case)
    const safeFile = await convertHeicIfNeeded(file);
    const imageUrl = URL.createObjectURL(safeFile);

    setSelectedImageUrl(imageUrl);
    setIsCropperOpen(true);
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors w-fit">
        <span>{label}</span>
        <input type="file" accept="image/*,.heic" onChange={handleFileChange} className="hidden" />
      </label>

      <ImageCropperModal
        imageSrc={selectedImageUrl}
        aspectRatio={aspectRatio}
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        onCropComplete={onImageCropped}
      />
    </div>
  );
};
