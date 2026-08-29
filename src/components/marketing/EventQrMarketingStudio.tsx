import React, { useRef, useState, useEffect } from 'react';
import { MarketingEventDetails, QrCustomizationOptions } from '@/types/eventMarketing';
import { renderMarketingFlyerCanvas } from '@/lib/marketing/qrCanvas';
import {
  QrCode,
  Download,
  Copy,
  Palette,
  Sliders,
  Sparkles,
  Printer,
  Check,
} from 'lucide-react';

interface EventQrMarketingStudioProps {
  event: MarketingEventDetails;
}

export function EventQrMarketingStudio({ event }: EventQrMarketingStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  const [options, setOptions] = useState<QrCustomizationOptions>({
    primaryColor: '#000000',
    backgroundColor: '#faf8f5',
    logoSizePercent: 20,
    pattern: 'squares',
    includeEventTitle: true,
    includeCallToAction: true,
    ctaText: 'Scan to RSVP & Save Seat',
    flyerTemplate: 'standard_flyer',
  });

  const colorPresets = [
    { name: 'Classic Black', hex: '#000000' },
    { name: 'Campus Lime', hex: '#65a30d' },
    { name: 'Electric Blue', hex: '#2563eb' },
    { name: 'Deep Purple', hex: '#7c3aed' },
    { name: 'Crimson Red', hex: '#dc2626' },
  ];

  // Re-render canvas whenever options change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      renderMarketingFlyerCanvas(canvas, event, options);
    }
  }, [event, options]);

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${event.eventId}-marketing-flyer.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(event.targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: Customization Controls */}
      <div className="space-y-6">
        <div>
          <h3 className="font-display font-black text-xl text-black flex items-center gap-2">
            <QrCode size={22} className="text-lime-700" /> Event Marketing QR Studio
          </h3>
          <p className="font-mono text-xs text-gray-600">
            Generate branded, high-resolution vector print flyers with your club logo embedded.
          </p>
        </div>

        {/* Color Presets */}
        <div className="space-y-2">
          <label className="block font-mono text-xs font-bold uppercase text-gray-700">
            Brand Accent Color
          </label>
          <div className="flex items-center gap-2">
            {colorPresets.map((preset) => (
              <button
                key={preset.hex}
                onClick={() => setOptions({ ...options, primaryColor: preset.hex })}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  options.primaryColor === preset.hex
                    ? 'border-black scale-110 ring-2 ring-lime'
                    : 'border-gray-300'
                }`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
              />
            ))}
          </div>
        </div>

        {/* QR Pattern Mode */}
        <div className="space-y-2">
          <label className="block font-mono text-xs font-bold uppercase text-gray-700">
            QR Data Pattern Style
          </label>
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <button
              onClick={() => setOptions({ ...options, pattern: 'squares' })}
              className={`p-2.5 border-2 rounded font-bold uppercase transition-all ${
                options.pattern === 'squares'
                  ? 'bg-lime text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-slate-50 border-slate-300 text-gray-600'
              }`}
            >
              Classic Matrix
            </button>
            <button
              onClick={() => setOptions({ ...options, pattern: 'dots' })}
              className={`p-2.5 border-2 rounded font-bold uppercase transition-all ${
                options.pattern === 'dots'
                  ? 'bg-lime text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-slate-50 border-slate-300 text-gray-600'
              }`}
            >
              Modern Rounded Dots
            </button>
          </div>
        </div>

        {/* Call to Action Text */}
        <div className="space-y-1 font-mono text-xs">
          <label className="block font-bold uppercase text-gray-700">
            Poster Call-to-Action Text
          </label>
          <input
            type="text"
            value={options.ctaText}
            onChange={(e) => setOptions({ ...options, ctaText: e.target.value })}
            className="w-full p-2.5 border-2 border-black rounded bg-white font-bold"
          />
        </div>

        {/* Actions Bar */}
        <div className="pt-4 border-t-2 border-slate-100 flex flex-wrap gap-3">
          <button
            onClick={handleDownloadPng}
            className="flex-1 py-3 bg-lime hover:bg-lime/90 border-2 border-black rounded font-mono text-xs font-black uppercase text-black flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-transform"
          >
            <Download size={16} /> Download Print PNG (300 DPI)
          </button>

          <button
            onClick={handleCopyLink}
            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 border-2 border-black rounded font-mono text-xs font-bold uppercase flex items-center gap-1.5"
          >
            {copied ? <Check size={16} className="text-emerald-700" /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy RSVP Link'}
          </button>
        </div>
      </div>

      {/* Right: Live Canvas Flyer Preview */}
      <div className="flex flex-col items-center justify-center p-4 bg-slate-100 border-2 border-black rounded-lg">
        <div className="max-w-xs w-full shadow-2xl rounded overflow-hidden border-2 border-black">
          <canvas
            ref={canvasRef}
            width={600}
            height={780}
            className="w-full h-auto block"
          />
        </div>
        <div className="flex items-center gap-1.5 mt-3 font-mono text-xs text-gray-500 font-bold">
          <Printer size={14} /> High-Resolution Ready for Physical Printing & Taping
        </div>
      </div>
    </div>
  );
}
