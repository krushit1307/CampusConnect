import React, { useState, useEffect, useRef } from 'react';
import {
  Vector3D,
  EulerOrientation,
  VenueSpatialNode,
  ArSpatialEvacuationPlan,
} from '../../types/evacuationHologram';
import { evacuationHologramService } from '../../services/evacuationHologramService';

export const EvacuationHologramView: React.FC = () => {
  const [emergencyActive, setEmergencyActive] = useState<boolean>(true);
  const [userPos, setUserPos] = useState<Vector3D>({ x: 0, y: 0, z: 2 });
  const [userOrientation, setUserOrientation] = useState<EulerOrientation>({ pitch: 0, yaw: 45, roll: 0 });
  const [plan, setPlan] = useState<ArSpatialEvacuationPlan | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [selectedScenario, setSelectedScenario] = useState<'stage_fire' | 'lobby_bottleneck' | 'clear_drill'>('stage_fire');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const calculateRoute = () => {
    try {
      const generatedPlan = evacuationHologramService.computeSafeHolographicEvacRoute(
        userPos,
        userOrientation,
        emergencyActive ? 'fire' : 'simulated_drill'
      );
      setPlan(generatedPlan);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    calculateRoute();
  }, [userPos, emergencyActive, selectedScenario]);

  // Render 3D Perspective Hologram Projection Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let pulsePhase = 0;

    const render = () => {
      pulsePhase += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Simulated AR Camera Feed background
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // AR Spatial Grid Floor Perspective
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1;
      const horizonY = canvas.height * 0.45;
      const centerX = canvas.width / 2;

      for (let x = -400; x <= 400; x += 40) {
        ctx.beginPath();
        ctx.moveTo(centerX + x * 0.1, horizonY);
        ctx.lineTo(centerX + x * 2.5, canvas.height);
        ctx.stroke();
      }

      for (let z = 1; z <= 12; z++) {
        const y = horizonY + Math.pow(z / 12, 1.8) * (canvas.height - horizonY);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Draw Massive Glowing Holographic AR Exit Arrows
      if (plan && plan.routeSteps.length > 0) {
        const glowAlpha = 0.6 + 0.4 * Math.sin(pulsePhase * 4);

        plan.routeSteps.forEach((step, idx) => {
          const depthOffset = (idx + 1) * 60;
          const y = canvas.height - 40 - depthOffset;
          const scale = 1.0 - idx * 0.18;
          const arrowX = centerX + (step.toPos.x - userPos.x) * 8;

          ctx.save();
          ctx.translate(arrowX, y);
          ctx.scale(scale, scale);

          // Outer Glow
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 25 * glowAlpha;

          // Arrow Geometry
          ctx.fillStyle = `rgba(16, 185, 129, ${glowAlpha})`;
          ctx.beginPath();
          ctx.moveTo(0, -35);
          ctx.lineTo(25, 5);
          ctx.lineTo(10, 5);
          ctx.lineTo(10, 30);
          ctx.lineTo(-10, 30);
          ctx.lineTo(-10, 5);
          ctx.lineTo(-25, 5);
          ctx.closePath();
          ctx.fill();

          // Chevron Pulse Lines
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Spatial Distance Tag
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(`WAYPOINT ${idx + 1} (${step.distanceMeters}m)`, 0, 48);

          ctx.restore();
        });

        // 3. Exit Gateway Holographic Beacon
        ctx.save();
        ctx.translate(centerX - 100, horizonY + 20);
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 30;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.fillRect(-4, -60, 8, 80);

        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`🚪 ${plan.safestExitName.toUpperCase()}`, 0, -70);
        ctx.restore();
      }

      // 4. AR Spatial HUD overlay
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px monospace';
      ctx.fillText(`AR VPS Tracking: FIXED (Accuracy: ±0.05m)`, 16, 28);
      ctx.fillText(`Sensors: LiDAR + IMU (Pitch: ${userOrientation.pitch}°, Yaw: ${userOrientation.yaw}°)`, 16, 46);

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [plan, userPos, userOrientation]);

  const handleScenarioChange = (scenario: 'stage_fire' | 'lobby_bottleneck' | 'clear_drill') => {
    setSelectedScenario(scenario);
    if (scenario === 'stage_fire') {
      evacuationHologramService.updateNodeHazards('node-stage-front', 350, 95);
      evacuationHologramService.updateNodeHazards('node-aisle-right', 480, 100);
      evacuationHologramService.updateNodeHazards('node-aisle-left', 20, 15);
      setUserPos({ x: 0, y: 0, z: 2 });
    } else if (scenario === 'lobby_bottleneck') {
      evacuationHologramService.updateNodeHazards('node-rear-lobby', 290, 99);
      evacuationHologramService.updateNodeHazards('node-exit-south', 120, 95);
      evacuationHologramService.updateNodeHazards('node-aisle-left', 10, 10);
      setUserPos({ x: 0, y: 0, z: 18 });
    } else {
      evacuationHologramService.updateNodeHazards('node-stage-front', 0, 10);
      evacuationHologramService.updateNodeHazards('node-aisle-right', 0, 10);
      evacuationHologramService.updateNodeHazards('node-aisle-left', 0, 10);
      setUserPos({ x: 0, y: 0, z: 0 });
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
              🚨 ARCore / ARKit Holographic Evacuation
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              VPS Spatial Localization
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">Interactive Event Layout Evacuation Hologram</h2>
          <p className="text-sm text-slate-400">
            Real-time smoke-penetrating 3D glowing AR floor projection routing around crowd crush risks
          </p>
        </div>

        {/* Emergency Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEmergencyActive(!emergencyActive)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg flex items-center gap-2 ${
              emergencyActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-bounce'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            {emergencyActive ? '⚠️ SEVERE FIRE EMERGENCY ACTIVE' : 'SIMULATE EMERGENCY ALARM'}
          </button>
        </div>
      </div>

      {/* Main Grid: Hologram AR Camera View + Real-time Evacuation HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AR Viewport (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl bg-black aspect-video flex items-center justify-center">
            <canvas ref={canvasRef} width={760} height={428} className="w-full h-full object-cover" />

            {/* In-Camera Visual HUD Elements */}
            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono text-cyan-300">
              HUD LIVE • 60 FPS • 800 LUMENS
            </div>

            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/85 backdrop-blur-md p-3 rounded-xl border border-emerald-500/40 text-emerald-300 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧭</span>
                <div>
                  <div className="font-bold text-white">{plan?.safestExitName || 'Calculating route...'}</div>
                  <div className="text-slate-400 text-[11px]">
                    Distance: {plan?.totalDistanceMeters}m | Estimated Time: {plan?.estimatedEvacTimeSeconds}s
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                Follow Floor Arrows
              </span>
            </div>
          </div>

          {/* Scenario & Camera Controls */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleScenarioChange('stage_fire')}
              className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                selectedScenario === 'stage_fire'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-200'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <div>🔥 Scenario A: Stage Fire</div>
              <div className="text-[10px] font-normal opacity-80 mt-0.5">Heavy smoke front, routes via West corridor</div>
            </button>
            <button
              onClick={() => handleScenarioChange('lobby_bottleneck')}
              className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                selectedScenario === 'lobby_bottleneck'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <div>👥 Scenario B: Crush Risk</div>
              <div className="text-[10px] font-normal opacity-80 mt-0.5">Main lobby congested, reroutes to side gate</div>
            </button>
            <button
              onClick={() => handleScenarioChange('clear_drill')}
              className={`p-3 rounded-xl border text-xs font-bold text-left transition ${
                selectedScenario === 'clear_drill'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <div>🎯 Scenario C: Clear Drill</div>
              <div className="text-[10px] font-normal opacity-80 mt-0.5">Standard optimal evacuation path</div>
            </button>
          </div>
        </div>

        {/* Right Sidebar: Step-by-Step Waypoint Guidance */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            📍 Spatial Waypoint Queue
          </h3>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {plan?.routeSteps.map((step) => (
              <div key={step.stepIndex} className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px]">
                      {step.stepIndex}
                    </span>
                    Step {step.stepIndex}
                  </span>
                  <span className="text-emerald-400 font-mono font-bold">{step.distanceMeters}m</span>
                </div>
                <p className="text-slate-300 text-[11px]">{step.instructionText}</p>
                <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-slate-800">
                  <span>From: {step.fromNodeId}</span>
                  <span>To: {step.toNodeId}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs space-y-1 text-indigo-300">
            <div className="font-bold flex items-center gap-1">
              <span>💡</span> Optical Hologram Specs:
            </div>
            <div className="text-[11px] opacity-90">• 800 Lumens High-Contrast Green (532nm)</div>
            <div className="text-[11px] opacity-90">• Penetrates dense smoke up to 450 PPM</div>
            <div className="text-[11px] opacity-90">• Spatial Anchoring via Google ARCore VPS Mesh</div>
          </div>
        </div>
      </div>
    </div>
  );
};
