import React, { useState } from "react";
import Sliders from "lucide-react/dist/esm/icons/sliders";
import X from "lucide-react/dist/esm/icons/x";
import Tag from "lucide-react/dist/esm/icons/tag";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Lock from "lucide-react/dist/esm/icons/lock";
import { DualRangeSlider } from "@/components/ui/DualRangeSlider";

interface DualRangeSliderStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilter?: (minPrice: number, maxPrice: number) => void;
}

const PRESET_PRICE_BUCKETS = [
  { label: "All Prices", range: [0, 100] as [number, number] },
  { label: "Free ($0)", range: [0, 0] as [number, number] },
  { label: "Budget (Under $25)", range: [0, 25] as [number, number] },
  { label: "Mid Tier ($25 - $60)", range: [25, 60] as [number, number] },
  { label: "VIP / Premium ($50+)", range: [50, 100] as [number, number] },
];

export const DualRangeSliderStudioModal: React.FC<DualRangeSliderStudioModalProps> = ({
  isOpen,
  onClose,
  onApplyFilter,
}) => {
  const [priceRange, setPriceRange] = useState<[number, number]>([15, 65]);
  const [committedRange, setCommittedRange] = useState<[number, number]>([15, 65]);
  const [minStep, setMinStep] = useState<number>(1);
  const [isCollisionTested, setIsCollisionTested] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleApply = () => {
    if (onApplyFilter) {
      onApplyFilter(committedRange[0], committedRange[1]);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border-4 border-black w-full max-w-2xl overflow-hidden font-mono flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl border border-white">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold uppercase">Dual Range Slider Studio</h2>
              <p className="text-xs text-slate-300">
                Min/Max Thumb Price Filter & Collision Inspector (#2320)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 bg-cream/40 overflow-y-auto">
          {/* Active Range Preview Box */}
          <div className="p-4 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-indigo-600" /> Active Price Filter Bounds
              </span>
              <div className="text-2xl font-extrabold text-black mt-1">
                ${priceRange[0]} <span className="text-gray-400 font-normal">to</span> $
                {priceRange[1]}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Committed State
              </span>
              <div className="text-sm font-extrabold text-emerald-600">
                ${committedRange[0]} – ${committedRange[1]}
              </div>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-gray-700 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Quick Filter Presets:
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_PRICE_BUCKETS.map((preset) => {
                const isActive =
                  priceRange[0] === preset.range[0] && priceRange[1] === preset.range[1];
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setPriceRange(preset.range);
                      setCommittedRange(preset.range);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg border transition ${
                      isActive
                        ? "bg-indigo-600 text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dual Range Slider Component under test */}
          <div className="p-6 bg-white border-2 border-black rounded-xl space-y-4">
            <h4 className="text-xs font-extrabold uppercase text-gray-800 flex items-center justify-between">
              <span>Interactive Dual Slider Control</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold">
                Auto Collision Protection
              </span>
            </h4>

            <DualRangeSlider
              min={0}
              max={100}
              step={minStep}
              value={priceRange}
              onValueChange={(val) => {
                setPriceRange(val);
                // Check if thumbs are colliding
                if (Math.abs(val[1] - val[0]) <= minStep) {
                  setIsCollisionTested(true);
                }
              }}
              onValueCommit={(val) => setCommittedRange(val)}
              formatLabel={(v) => `$${v}`}
            />
          </div>

          {/* Collision Telemetry Banner */}
          <div className="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-xl flex items-center justify-between text-indigo-950">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <div>
                <h5 className="font-bold text-xs uppercase">Radix Primitive Clamping</h5>
                <p className="text-[11px] opacity-80">
                  Min thumb physically cannot cross Max thumb. Distance collision is mathematically
                  enforced.
                </p>
              </div>
            </div>
            {isCollisionTested && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Collision Verified
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-100 border-t-2 border-black flex justify-between items-center">
          <button
            onClick={() => {
              setPriceRange([0, 100]);
              setCommittedRange([0, 100]);
            }}
            className="px-3 py-1.5 bg-white border border-black text-xs font-bold uppercase rounded-lg flex items-center gap-1.5 hover:bg-gray-200"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Bounds
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-black font-bold uppercase text-xs rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 bg-black text-white font-bold uppercase text-xs rounded-lg hover:bg-gray-800 transition"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
