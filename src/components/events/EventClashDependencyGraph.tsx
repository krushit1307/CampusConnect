/**
 * Interactive Event Clash Dependency Graph Component
 * Visualizes nodes (events), edges (demographic/temporal clashes), and color-coded
 * conflict severity with SVG canvas rendering, node inspection, and collision warnings.
 * Issue #4140
 */

import React, { useState } from 'react';
import {
  ClashGraphNode,
  ClashGraphEdge,
  EventClashAnalysisResult,
  ClashSeverity,
} from '../../types/eventClashGraph';
import {
  AlertOctagon,
  Sparkles,
  Layers,
  Users,
  Clock,
  Tag,
  Info,
  CalendarCheck,
} from 'lucide-react';

interface EventClashDependencyGraphProps {
  analysis: EventClashAnalysisResult;
  onSelectNode?: (node: ClashGraphNode) => void;
  onApplyReschedule?: (newStartTime: string, newEndTime: string) => void;
}

export const EventClashDependencyGraph: React.FC<
  EventClashDependencyGraphProps
> = ({ analysis, onSelectNode, onApplyReschedule }) => {
  const { nodes, edges, verdict, highest_clash_score, overall_clash_severity } =
    analysis;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const hoveredEdge = edges.find((e) => e.id === hoveredEdgeId);

  const viewBoxWidth = 640;
  const viewBoxHeight = 440;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl space-y-4 p-5">
      {/* Top Banner with Verdict Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2.5 rounded-2xl border ${
              overall_clash_severity === 'critical'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                : overall_clash_severity === 'high'
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                : overall_clash_severity === 'medium'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-100 flex items-center space-x-2">
              <span>{verdict.headline}</span>
            </h3>
            <p className="text-xs text-slate-400">{verdict.advice}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border ${
              overall_clash_severity === 'critical'
                ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
                : overall_clash_severity === 'high'
                ? 'bg-orange-600/20 text-orange-300 border-orange-500/40'
                : overall_clash_severity === 'medium'
                ? 'bg-amber-600/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            Clash Index: {highest_clash_score} / 100
          </span>
        </div>
      </div>

      {/* Main SVG Force Graph Visualizer */}
      <div className="relative w-full h-[400px] bg-slate-900/80 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full select-none"
        >
          <defs>
            {/* Pulsing red glow filter for critical clash edges */}
            <filter id="criticalGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Center proposed node gradient */}
            <radialGradient id="proposedGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </radialGradient>
            <radialGradient id="competingGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1e293b" />
            </radialGradient>
          </defs>

          {/* 1. Render Clash Edges (Lines between Proposed and Competing Events) */}
          {edges.map((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const isHovered = hoveredEdgeId === edge.id;
            const isCritical = edge.is_critical_clash;

            return (
              <g key={edge.id}>
                {/* Thick glow underlay on critical clash */}
                {isCritical && (
                  <line
                    x1={sourceNode.x}
                    y1={sourceNode.y}
                    x2={targetNode.x}
                    y2={targetNode.y}
                    stroke="#ef4444"
                    strokeWidth={edge.stroke_width * 2.2}
                    opacity="0.35"
                    filter="url(#criticalGlow)"
                  />
                )}

                {/* Primary Edge Line */}
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={edge.color}
                  strokeWidth={isHovered ? edge.stroke_width + 2 : edge.stroke_width}
                  strokeDasharray={edge.severity === 'none' ? '4 4' : undefined}
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseLeave={() => setHoveredEdgeId(null)}
                />

                {/* Midpoint Clash Score Badge */}
                {edge.clash_score > 0 && (
                  <g
                    transform={`translate(${
                      (sourceNode.x! + targetNode.x!) / 2
                    }, ${(sourceNode.y! + targetNode.y!) / 2})`}
                  >
                    <rect
                      x="-22"
                      y="-11"
                      width="44"
                      height="22"
                      rx="6"
                      fill={edge.is_critical_clash ? '#7f1d1d' : '#0f172a'}
                      stroke={edge.color}
                      strokeWidth="1.5"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="Inter, sans-serif"
                    >
                      {Math.round(edge.clash_score)}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 2. Render Graph Nodes */}
          {nodes.map((node) => {
            const isProposed = node.is_proposed;
            const isSelected = selectedNodeId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => {
                  setSelectedNodeId(node.id);
                  if (onSelectNode) onSelectNode(node);
                }}
                className="cursor-pointer group"
              >
                {/* Aura ring for proposed target */}
                {isProposed && (
                  <circle
                    r={node.radius! + 10}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="animate-spin"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={node.radius}
                  fill={isProposed ? 'url(#proposedGrad)' : 'url(#competingGrad)'}
                  stroke={
                    isSelected
                      ? '#38bdf8'
                      : isProposed
                      ? '#60a5fa'
                      : '#64748b'
                  }
                  strokeWidth={isSelected ? 3.5 : 2}
                  className="transition-all duration-200 group-hover:scale-105"
                />

                {/* Node Label Text */}
                <text
                  textAnchor="middle"
                  dy="-4"
                  fill="#ffffff"
                  fontSize={isProposed ? '11' : '10'}
                  fontWeight="bold"
                  fontFamily="Inter, sans-serif"
                >
                  {isProposed ? '★ PROPOSED' : node.club_name.slice(0, 14)}
                </text>

                <text
                  textAnchor="middle"
                  dy="12"
                  fill="#cbd5e1"
                  fontSize="9"
                  fontFamily="Inter, sans-serif"
                >
                  ~{node.attendance} RSVPs
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Legend */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1 shadow-lg max-w-[210px]">
          <div className="font-semibold text-slate-100 flex items-center space-x-1.5 pb-1 border-b border-slate-800">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Conflict Severity Legend</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-1 bg-rose-500 rounded"></span>
            <span className="text-rose-400 font-medium">Critical (70%+ overlap)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-1 bg-orange-500 rounded"></span>
            <span className="text-orange-400">High (48% - 70%)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-1 bg-amber-500 rounded"></span>
            <span className="text-amber-400">Medium (25% - 48%)</span>
          </div>
        </div>

        {/* Hovered Edge Tooltip */}
        {hoveredEdge && (
          <div className="absolute top-3 right-3 bg-slate-900/95 backdrop-blur border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs space-y-1.5 max-w-xs animate-in fade-in">
            <div className="font-bold text-slate-100 flex items-center justify-between">
              <span>Demographic Clash Breakdown</span>
              <span className="text-rose-400 capitalize">
                {hoveredEdge.severity}
              </span>
            </div>
            <p className="text-slate-300">
              {hoveredEdge.overlap_metric.cannibalization_risk_summary}
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-slate-400 text-[11px]">
              <span>
                Historical Co-attendance: {hoveredEdge.overlap_metric.historical_rsvp_overlap_percentage}%
              </span>
              <span>
                Tag Match: {Math.round(hoveredEdge.overlap_metric.tag_jaccard_similarity * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-100">
              {selectedNode.title}
            </h4>
            <span className="text-slate-400 font-mono">
              Hosted by {selectedNode.club_name}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {selectedNode.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
