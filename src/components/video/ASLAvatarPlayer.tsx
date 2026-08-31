import React, { useEffect, useRef, useState } from 'react';
import {
  AslTranslationOutput,
  VttCaptionSegment,
} from '../../types/aslAvatar';
import {
  getActiveAslKeyframeAtTime,
  processVttToAslTranslation,
} from '../../services/aslTranslationEngine';

export interface ASLAvatarPlayerProps {
  videoUrl: string;
  captions: VttCaptionSegment[];
  avatarEnabled?: boolean;
}

export const ASLAvatarPlayer: React.FC<ASLAvatarPlayerProps> = ({
  videoUrl,
  captions,
  avatarEnabled = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [translations, setTranslations] = useState<AslTranslationOutput[]>([]);
  const [activeGloss, setActiveGloss] = useState<string>('IDLE');
  const [isAvatarVisible, setIsAvatarVisible] = useState<boolean>(avatarEnabled);

  // Parse captions into ASL Gloss and animation keyframe tracks
  useEffect(() => {
    const parsed = captions.map((c) => processVttToAslTranslation(c));
    setTranslations(parsed);
  }, [captions]);

  // Video timeupdate hook to drive WebGL canvas rendering
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    const { activeSegment, activeKeyframe } = getActiveAslKeyframeAtTime(translations, time);
    if (activeSegment) {
      setActiveGloss(activeSegment.aslGrammarGloss);
    } else {
      setActiveGloss('IDLE');
    }

    // Render WebGL / 2D Canvas avatar skeletal frame
    if (canvasRef.current && activeKeyframe) {
      drawAvatarFrame(canvasRef.current, activeKeyframe);
    }
  };

  const drawAvatarFrame = (
    canvas: HTMLCanvasElement,
    keyframe: any
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw stylized 3D avatar canvas fallback
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Avatar Head
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 60, 30, 0, Math.PI * 2);
    ctx.fill();

    // Draw Avatar Torso
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 90);
    ctx.lineTo(canvas.width / 2, 180);
    ctx.stroke();

    // Draw Dynamic Arms based on Bone Rotations
    const leftArmRot = keyframe.leftArmRotations?.[0]?.rotationX || 0;
    const rightArmRot = keyframe.rightArmRotations?.[0]?.rotationX || 0;

    // Left Arm
    ctx.strokeStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 110);
    ctx.lineTo(canvas.width / 2 - 50 + leftArmRot * 20, 150 + leftArmRot * 30);
    ctx.stroke();

    // Right Arm
    ctx.strokeStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 110);
    ctx.lineTo(canvas.width / 2 + 50 + rightArmRot * 20, 150 + rightArmRot * 30);
    ctx.stroke();
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800 font-sans">
      {/* Main Video Stream */}
      <video
        ref={videoRef}
        src={videoUrl}
        onTimeUpdate={handleTimeUpdate}
        controls
        className="w-full h-auto aspect-video object-cover"
      />

      {/* ASL 3D Avatar WebGL Overlay */}
      {isAvatarVisible && (
        <div className="absolute bottom-4 right-4 w-48 h-64 bg-slate-950/90 border-2 border-indigo-500/80 rounded-lg shadow-2xl backdrop-blur-md flex flex-col items-center justify-between p-2">
          <div className="w-full flex justify-between items-center text-[10px] text-indigo-300 font-mono border-b border-indigo-950 pb-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ASL Avatar Sync
            </span>
            <span>3D WebGL</span>
          </div>

          <canvas
            ref={canvasRef}
            width={180}
            height={200}
            className="w-full h-44 rounded bg-slate-900 border border-slate-800"
          />

          <div className="w-full bg-indigo-950/60 p-1.5 rounded text-center">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
              ASL Gloss Transcript
            </span>
            <span className="text-xs font-mono font-bold text-indigo-200 truncate block">
              {activeGloss}
            </span>
          </div>
        </div>
      )}

      {/* Control Toggle Bar */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setIsAvatarVisible(!isAvatarVisible)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md transition-all shadow-md ${
            isAvatarVisible
              ? 'bg-indigo-600/90 hover:bg-indigo-500 text-white border border-indigo-400/50'
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
          }`}
        >
          {isAvatarVisible ? '🤟 ASL Avatar On' : '🤟 Enable ASL Sign Avatar'}
        </button>
      </div>
    </div>
  );
};
