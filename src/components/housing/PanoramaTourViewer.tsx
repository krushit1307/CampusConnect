import React, { useRef, useState, useEffect } from 'react';
import { Eye, RotateCw, MoveHorizontal, Compass, Maximize2 } from 'lucide-react';

interface PanoramaTourViewerProps {
  imageUrl: string;
  roomTitle: string;
}

export function PanoramaTourViewer({ imageUrl, roomTitle }: PanoramaTourViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [panOffset, setPanOffset] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      renderPanorama(panOffset);
    };
  }, [imageUrl]);

  const renderPanorama = (offset: number) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Panoramic cylindrical wrap simulation
    const srcWidth = img.width;
    const srcHeight = img.height;
    const normalizedOffset = ((offset % srcWidth) + srcWidth) % srcWidth;

    // Draw primary slice
    ctx.drawImage(
      img,
      normalizedOffset,
      0,
      srcWidth - normalizedOffset,
      srcHeight,
      0,
      0,
      w * ((srcWidth - normalizedOffset) / srcWidth),
      h
    );

    // Draw wrapped slice
    if (normalizedOffset > 0) {
      ctx.drawImage(
        img,
        0,
        0,
        normalizedOffset,
        srcHeight,
        w * ((srcWidth - normalizedOffset) / srcWidth),
        0,
        w * (normalizedOffset / srcWidth),
        h
      );
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const delta = (e.clientX - startX) * 2;
    const newOffset = panOffset - delta;
    setPanOffset(newOffset);
    setStartX(e.clientX);
    renderPanorama(newOffset);
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="bg-white border-2 border-black rounded-lg overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="p-3 border-b-2 border-black bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass size={18} className="text-blue-600" />
          <span className="font-display font-black text-sm text-black">
            360° Virtual Tour • {roomTitle}
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-xs text-gray-500">
          <MoveHorizontal size={14} /> Drag horizontally to look around
        </div>
      </div>

      <div
        className="relative aspect-16/9 w-full bg-black cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full object-cover block"
        />

        <div className="absolute bottom-3 left-3 bg-black/70 text-white font-mono text-[10px] px-2 py-1 rounded backdrop-blur-xs flex items-center gap-1.5">
          <RotateCw size={12} className="animate-spin" /> Interactive Panorama
        </div>
      </div>
    </div>
  );
}
