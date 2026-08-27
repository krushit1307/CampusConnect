import { useState } from 'react';

interface SafeImageProps {
  id: string;
  src: string;
  alt: string;
  initialIsNsfw: boolean;
  isAdmin: boolean;
  className?: string;
}

export default function SafeEventImage({ id, src, alt, initialIsNsfw, isAdmin, className = "" }: SafeImageProps) {
  const [isNsfw, setIsNsfw] = useState<boolean>(initialIsNsfw);
  const [overrideBlur, setOverrideBlur] = useState<boolean>(false);

  const shouldBlur = isNsfw && !overrideBlur;

  return (
    <div className={`relative w-full aspect-square rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 shadow-inner group ${className}`}>
      {/* Target Render Media Canvas */}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-500 ${
          shouldBlur ? 'blur-[25px] scale-105 pointer-events-none select-none' : 'blur-0 scale-100'
        }`}
        loading="lazy"
      />

      {/* Defensive Content Hidden Overlay Mask */}
      {shouldBlur && (
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-4 text-center backdrop-blur-sm animate-fadeIn z-10">
          <span className="text-2xl mb-1">⚠️</span>
          <h4 className="text-white text-xs font-black uppercase tracking-wider">Content Hidden</h4>
          <p className="text-[11px] text-gray-200 mt-1 max-w-[180px] leading-snug">
            This image was blurred automatically pending structural moderation review.
          </p>

          {/* Render target inspection buttons exclusively to authorized administrators */}
          {isAdmin && (
            <button
              onClick={() => setOverrideBlur(true)}
              className="mt-3 px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg border border-white/30 backdrop-blur transition-all"
            >
              👁️ Override Blur (Admin)
            </button>
          )}
        </div>
      )}

      {/* Permanent visual confirmation toggle banner for viewing Admins */}
      {isAdmin && !shouldBlur && isNsfw && (
        <div className="absolute top-2 right-2 z-10 bg-amber-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-md tracking-wider">
          Quarantined Asset
        </div>
      )}
    </div>
  );
}
