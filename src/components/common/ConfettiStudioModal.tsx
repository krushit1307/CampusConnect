import React from "react";
import { Sparkles, Zap, Shield, EyeOff, Award, Flame, X, Info } from "lucide-react";
import { useConfetti } from "../../hooks/useConfetti";
import { BRAND_CONFETTI_COLORS } from "../../lib/confettiEngine";

interface ConfettiStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfettiStudioModal: React.FC<ConfettiStudioModalProps> = ({ isOpen, onClose }) => {
  const {
    fireCannon,
    fireCelebration,
    fireFireworks,
    fireStars,
    isReducedMotion,
    reducedMotionOverride,
    setReducedMotionOverride,
  } = useConfetti();

  if (!isOpen) return null;

  const isSuppressed = isReducedMotion || reducedMotionOverride;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border-4 border-black w-full max-w-2xl overflow-hidden font-mono">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-xl animate-pulse">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold uppercase">Confetti Cannon Studio</h2>
              <p className="text-xs text-slate-300">
                Celebration Micro-Animations & Accessibility Telemetry (#2257)
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

        {/* Accessibility Status Alert */}
        <div className="p-6 space-y-6 bg-cream/30">
          <div
            className={`p-4 border-2 rounded-xl flex items-center justify-between ${
              isSuppressed
                ? "bg-amber-50 border-amber-400 text-amber-900"
                : "bg-emerald-50 border-emerald-400 text-emerald-900"
            }`}
          >
            <div className="flex items-center gap-3">
              {isSuppressed ? (
                <EyeOff className="w-6 h-6 text-amber-600 flex-shrink-0" />
              ) : (
                <Zap className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              )}
              <div>
                <h4 className="font-bold text-sm uppercase">
                  {isSuppressed
                    ? "Accessibility Guard: Confetti Suppressed"
                    : "Confetti Animations Active"}
                </h4>
                <p className="text-xs opacity-90">
                  {isReducedMotion
                    ? "OS Setting 'prefers-reduced-motion: reduce' detected. Animations auto-disabled."
                    : reducedMotionOverride
                      ? "Manual Accessibility Preview Override enabled."
                      : "Full 60 FPS physics confetti particles enabled for major milestones."}
                </p>
              </div>
            </div>

            <button
              onClick={() => setReducedMotionOverride(!reducedMotionOverride)}
              className="px-3 py-1.5 bg-white border border-black text-xs font-bold uppercase rounded-lg hover:bg-gray-100 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              {reducedMotionOverride ? "Enable Confetti" : "Simulate Reduced Motion"}
            </button>
          </div>

          {/* Cannons Action Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase text-gray-700 tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-purple-600" /> Interactive Cannon Triggers
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Dual Edge Cannon */}
              <button
                onClick={() => fireCannon()}
                className="p-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold uppercase text-xs border-2 border-black hover:-translate-y-1 transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between group"
              >
                <div className="text-left">
                  <span className="block text-sm">Dual Edge Cannon</span>
                  <span className="text-[10px] font-normal opacity-80">
                    Left (60°) & Right (120° @ 200ms)
                  </span>
                </div>
                <Zap className="w-5 h-5 group-hover:scale-125 transition-transform" />
              </button>

              {/* Celebration Center Burst */}
              <button
                onClick={() => fireCelebration()}
                className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold uppercase text-xs border-2 border-black hover:-translate-y-1 transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between group"
              >
                <div className="text-left">
                  <span className="block text-sm">Celebration Burst</span>
                  <span className="text-[10px] font-normal opacity-80">
                    150 particles, multi-shape burst
                  </span>
                </div>
                <Award className="w-5 h-5 group-hover:scale-125 transition-transform" />
              </button>

              {/* Multi-stage Fireworks */}
              <button
                onClick={() => fireFireworks()}
                className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold uppercase text-xs border-2 border-black hover:-translate-y-1 transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between group"
              >
                <div className="text-left">
                  <span className="block text-sm">Fireworks Stream</span>
                  <span className="text-[10px] font-normal opacity-80">
                    3 sequential atmospheric explosions
                  </span>
                </div>
                <Sparkles className="w-5 h-5 group-hover:scale-125 transition-transform" />
              </button>

              {/* Golden Stars Burst */}
              <button
                onClick={() => fireStars()}
                className="p-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold uppercase text-xs border-2 border-black hover:-translate-y-1 transition shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between group"
              >
                <div className="text-left">
                  <span className="block text-sm">Golden Star Burst</span>
                  <span className="text-[10px] font-normal opacity-80">
                    Star-shaped vector particles
                  </span>
                </div>
                <Sparkles className="w-5 h-5 group-hover:scale-125 transition-transform" />
              </button>
            </div>
          </div>

          {/* Brand Palette Inspection */}
          <div className="p-4 bg-white border-2 border-black rounded-xl space-y-2">
            <h4 className="text-xs font-bold uppercase text-gray-700 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" /> Platform Brand Palette Tokens
            </h4>
            <div className="flex items-center gap-2">
              {BRAND_CONFETTI_COLORS.map((color, i) => (
                <div
                  key={i}
                  className="flex-1 h-8 rounded-lg border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] relative group cursor-pointer"
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    {color}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-100 border-t-2 border-black flex justify-between items-center text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Info className="w-4 h-4 text-indigo-600" /> Bound to Create Club, Charter Approval &
            RSVP mutations
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border-2 border-black text-black font-bold uppercase rounded-lg hover:bg-gray-200 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
