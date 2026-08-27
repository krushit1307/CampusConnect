import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Area, getCroppedImg } from "../../utils/imageUtils";

interface ImageCropperModalProps {
  imageSrc: string | null;
  aspectRatio?: number; // e.g., 1 for Avatar (1:1), 16/9 for Banner (16:9)
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  imageSrc,
  aspectRatio = 1,
  isOpen,
  onClose,
  onCropComplete,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const handleCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setIsProcessing(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedBlob);
      onClose();
    } catch (error) {
      console.error("Failed to crop image:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="relative w-full max-w-lg rounded-xl bg-gray-900 p-6 text-white shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold">Crop Your Image</h3>

        {/* Cropper Container */}
        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-gray-800">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={handleCropComplete}
          />
        </div>

        {/* Zoom Slider */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-gray-400">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full cursor-pointer accent-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isProcessing ? "Processing..." : "Save & Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};
