import React, { useRef, useEffect, useState } from "react";
import {
  Vector3D,
  AcousticSpeakerConfig,
  AcousticRay,
  AcousticWallConfig,
} from "../../types/acoustic";
import { vecLength, vecSub, vecNormalize } from "../../lib/acousticRayTracer";

interface AcousticVisualizerCanvasProps {
  widthMeters: number;
  depthMeters: number;
  speakers: AcousticSpeakerConfig[];
  rays: AcousticRay[];
  walls: AcousticWallConfig[];
  selectedSpeakerId: string | null;
  onSelectSpeaker: (id: string | null) => void;
  onUpdateSpeaker: (speaker: AcousticSpeakerConfig) => void;
}

export const AcousticVisualizerCanvas: React.FC<AcousticVisualizerCanvasProps> = ({
  widthMeters,
  depthMeters,
  speakers,
  rays,
  walls,
  selectedSpeakerId,
  onSelectSpeaker,
  onUpdateSpeaker,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"position" | "rotation" | null>(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  // Canvas coordinate transformation metrics
  const getScaleAndOffset = (canvasWidth: number, canvasHeight: number) => {
    const padding = 40;
    const availableWidth = canvasWidth - padding * 2;
    const availableHeight = canvasHeight - padding * 2;

    const scaleX = availableWidth / widthMeters;
    const scaleZ = availableHeight / depthMeters;
    const scale = Math.min(scaleX, scaleZ);

    const offsetX = canvasWidth / 2;
    const offsetZ = canvasHeight / 2;

    return { scale, offsetX, offsetZ };
  };

  const toCanvasCoords = (
    x: number,
    z: number,
    scale: number,
    offsetX: number,
    offsetZ: number,
  ) => {
    return {
      cx: offsetX + x * scale,
      cy: offsetZ + z * scale,
    };
  };

  const toRoomCoords = (
    cx: number,
    cy: number,
    scale: number,
    offsetX: number,
    offsetZ: number,
  ) => {
    return {
      rx: (cx - offsetX) / scale,
      rz: (cy - offsetZ) / scale,
    };
  };

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { scale, offsetX, offsetZ } = getScaleAndOffset(canvas.width, canvas.height);

    // 1. Draw Grid Floor
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    const gridStep = 2; // grid line every 2 meters
    for (let x = -widthMeters / 2; x <= widthMeters / 2; x += gridStep) {
      const start = toCanvasCoords(x, -depthMeters / 2, scale, offsetX, offsetZ);
      const end = toCanvasCoords(x, depthMeters / 2, scale, offsetX, offsetZ);
      ctx.beginPath();
      ctx.moveTo(start.cx, start.cy);
      ctx.lineTo(end.cx, end.cy);
      ctx.stroke();
    }
    for (let z = -depthMeters / 2; z <= depthMeters / 2; z += gridStep) {
      const start = toCanvasCoords(-widthMeters / 2, z, scale, offsetX, offsetZ);
      const end = toCanvasCoords(widthMeters / 2, z, scale, offsetX, offsetZ);
      ctx.beginPath();
      ctx.moveTo(start.cx, start.cy);
      ctx.lineTo(end.cx, end.cy);
      ctx.stroke();
    }

    // 2. Draw Walls with Visual Absorption Levels
    const drawWall = (
      start: { x: number; z: number },
      end: { x: number; z: number },
      wallType: string,
    ) => {
      const wallConfig = walls.find((w) => w.type === wallType);
      const abs = wallConfig ? wallConfig.absorptionCoefficient : 0.1;

      const pStart = toCanvasCoords(start.x, start.z, scale, offsetX, offsetZ);
      const pEnd = toCanvasCoords(end.x, end.z, scale, offsetX, offsetZ);

      ctx.beginPath();
      ctx.moveTo(pStart.cx, pStart.cy);
      ctx.lineTo(pEnd.cx, pEnd.cy);

      // Solid color based on reflection (1 - absorption)
      const reflection = 1 - abs;
      ctx.lineWidth = 6;
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 + reflection * 0.7})`; // darker means more reflective
      ctx.stroke();

      // Dashed blue overlay representing absorption
      if (abs > 0.3) {
        ctx.beginPath();
        ctx.moveTo(pStart.cx, pStart.cy);
        ctx.lineTo(pEnd.cx, pEnd.cy);
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(59, 130, 246, ${abs * 0.8})`; // blue dashes
        ctx.setLineDash([5, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    const halfW = widthMeters / 2;
    const halfD = depthMeters / 2;

    drawWall({ x: -halfW, z: -halfD }, { x: halfW, z: -halfD }, "back");
    drawWall({ x: halfW, z: -halfD }, { x: halfW, z: halfD }, "right");
    drawWall({ x: halfW, z: halfD }, { x: -halfW, z: halfD }, "front");
    drawWall({ x: -halfW, z: halfD }, { x: -halfW, z: -halfD }, "left");

    // 3. Draw Acoustic Rays
    ctx.lineWidth = 1.2;
    rays.forEach((ray) => {
      if (ray.points.length < 2) return;

      // Draw each segment of the ray
      for (let i = 0; i < ray.points.length - 1; i++) {
        const p1 = toCanvasCoords(ray.points[i].x, ray.points[i].z, scale, offsetX, offsetZ);
        const p2 = toCanvasCoords(
          ray.points[i + 1].x,
          ray.points[i + 1].z,
          scale,
          offsetX,
          offsetZ,
        );

        ctx.beginPath();
        ctx.moveTo(p1.cx, p1.cy);
        ctx.lineTo(p2.cx, p2.cy);

        // Compute color based on remaining energy ratio (green -> yellow -> red -> fade)
        const energyRatio = ray.energy; // normalized relative energy
        let strokeColor = "rgba(34, 197, 94, 0.45)"; // bright green

        if (i === 1) {
          strokeColor = "rgba(234, 179, 8, 0.35)"; // yellow
        } else if (i === 2) {
          strokeColor = "rgba(249, 115, 22, 0.25)"; // orange
        } else if (i >= 3) {
          strokeColor = "rgba(239, 68, 68, 0.15)"; // red
        }

        ctx.strokeStyle = strokeColor;
        ctx.stroke();
      }
    });

    // 4. Draw Speakers and their direction vectors
    speakers.forEach((speaker) => {
      const isSelected = selectedSpeakerId === speaker.id;
      const { cx, cy } = toCanvasCoords(speaker.x, speaker.z, scale, offsetX, offsetZ);

      // Draw dispersion cone
      const yawRad = (speaker.yaw * Math.PI) / 180;
      const coneRad = (speaker.coneAngle * Math.PI) / 360;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(
        cx,
        cy,
        scale * 3.5, // 3.5 meters cone length representation
        yawRad - coneRad,
        yawRad + coneRad,
        false,
      );
      ctx.closePath();
      ctx.fillStyle = isSelected ? "rgba(147, 51, 234, 0.08)" : "rgba(79, 70, 229, 0.05)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = isSelected ? "rgba(147, 51, 234, 0.3)" : "rgba(79, 70, 229, 0.2)";
      ctx.stroke();

      // Draw speaker node body
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#a855f7" : "#4f46e5";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();

      // Draw small front face/horn direction line
      const hornLength = 15;
      const hx = cx + Math.sin(yawRad) * hornLength;
      const hy = cy + Math.cos(yawRad) * hornLength;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Outer targeting circle if selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.strokeStyle = "#f59e0b"; // amber target ring
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Rotation handles
        const handleLength = scale * 2.2;
        const rx = cx + Math.sin(yawRad) * handleLength;
        const ry = cy + Math.cos(yawRad) * handleLength;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }

      // Draw label
      ctx.fillStyle = "#000000";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(speaker.label, cx, cy - 16);
    });
  }, [widthMeters, depthMeters, speakers, rays, walls, selectedSpeakerId]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const { scale, offsetX, offsetZ } = getScaleAndOffset(canvas.width, canvas.height);

    // Check click targets
    for (const speaker of speakers) {
      const sPos = toCanvasCoords(speaker.x, speaker.z, scale, offsetX, offsetZ);

      // Check rotation handle click (first priority)
      if (selectedSpeakerId === speaker.id) {
        const yawRad = (speaker.yaw * Math.PI) / 180;
        const handleLength = scale * 2.2;
        const rx = sPos.cx + Math.sin(yawRad) * handleLength;
        const ry = sPos.cy + Math.cos(yawRad) * handleLength;

        const distToHandle = Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2);
        if (distToHandle <= 8) {
          setIsDragging(true);
          setDragMode("rotation");
          setActiveSpeakerId(speaker.id);
          return;
        }
      }

      // Check speaker body click
      const distToBody = Math.sqrt((cx - sPos.cx) ** 2 + (cy - sPos.cy) ** 2);
      if (distToBody <= 12) {
        onSelectSpeaker(speaker.id);
        setIsDragging(true);
        setDragMode("position");
        setActiveSpeakerId(speaker.id);
        return;
      }
    }

    // Clicked empty area
    onSelectSpeaker(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !activeSpeakerId || !dragMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const { scale, offsetX, offsetZ } = getScaleAndOffset(canvas.width, canvas.height);
    const speaker = speakers.find((s) => s.id === activeSpeakerId);
    if (!speaker) return;

    if (dragMode === "position") {
      const roomPos = toRoomCoords(cx, cy, scale, offsetX, offsetZ);
      // Bound checking within room limits
      const halfW = widthMeters / 2 - 0.5;
      const halfD = depthMeters / 2 - 0.5;

      const boundedX = Math.max(-halfW, Math.min(halfW, roomPos.rx));
      const boundedZ = Math.max(-halfD, Math.min(halfD, roomPos.rz));

      onUpdateSpeaker({
        ...speaker,
        x: Number(boundedX.toFixed(2)),
        z: Number(boundedZ.toFixed(2)),
      });
    } else if (dragMode === "rotation") {
      const sPos = toCanvasCoords(speaker.x, speaker.z, scale, offsetX, offsetZ);
      // Calculate angle from speaker center to mouse pointer
      const dx = cx - sPos.cx;
      const dy = cy - sPos.cy;

      const angleRad = Math.atan2(dx, dy); // angle in radians, 0 facing +Z
      let angleDeg = Math.round((angleRad * 180) / Math.PI);

      if (angleDeg < 0) {
        angleDeg += 360;
      }

      onUpdateSpeaker({
        ...speaker,
        yaw: angleDeg,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
    setActiveSpeakerId(null);
  };

  return (
    <div className="border-2 border-black rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center p-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={400}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="max-w-full h-auto cursor-crosshair block"
      />
    </div>
  );
};
