import React, { useRef, useState, useEffect, useCallback } from 'react';
import { WhiteboardElement, UserPresence } from '@/types/collaboration';
import {
  Pencil,
  Square,
  Circle,
  Type,
  StickyNote,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Users
} from 'lucide-react';

interface CollaborativeWhiteboardProps {
  sessionId: string;
  elements: WhiteboardElement[];
  onElementsChange: (elements: WhiteboardElement[]) => void;
  activeUsers: UserPresence[];
  currentUser: { id: string; name: string; color: string };
}

type ToolMode = 'pencil' | 'rectangle' | 'circle' | 'text' | 'sticky' | 'eraser';

export function CollaborativeWhiteboard({
  elements,
  onElementsChange,
  activeUsers,
  currentUser
}: CollaborativeWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolMode>('pencil');
  const [selectedColor, setSelectedColor] = useState<string>('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [history, setHistory] = useState<WhiteboardElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const colors = [
    '#1e293b', // Slate / Black
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
  ];

  // Save history on changes
  const pushState = useCallback((newElements: WhiteboardElement[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    setHistory([...updatedHistory, newElements]);
    setHistoryIndex(updatedHistory.length);
    onElementsChange(newElements);
  }, [history, historyIndex, onElementsChange]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      onElementsChange(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      onElementsChange(history[historyIndex + 1]);
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear the entire whiteboard canvas for all users?')) {
      pushState([]);
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid background
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    const gridSize = 25;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Render stored elements
    elements.forEach((el) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'path' && el.points && el.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === 'rectangle' && el.x !== undefined && el.y !== undefined && el.width && el.height) {
        ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === 'circle' && el.x !== undefined && el.y !== undefined && el.width) {
        ctx.beginPath();
        ctx.arc(el.x, el.y, Math.abs(el.width / 2), 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'sticky' && el.x !== undefined && el.y !== undefined) {
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 8;
        ctx.fillRect(el.x, el.y, 140, 100);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#eab308';
        ctx.strokeRect(el.x, el.y, 140, 100);

        ctx.fillStyle = '#0f172a';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(el.text || 'Sticky Note', el.x + 10, el.y + 25);
        ctx.font = '9px monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`- ${el.authorName}`, el.x + 10, el.y + 85);
      } else if (el.type === 'text' && el.x !== undefined && el.y !== undefined) {
        ctx.font = `${el.strokeWidth * 6}px Inter, sans-serif`;
        ctx.fillText(el.text || '', el.x, el.y);
      }
    });

    // Draw active drawing in-progress
    if (isDrawing) {
      ctx.strokeStyle = selectedColor;
      ctx.fillStyle = selectedColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (currentTool === 'pencil' && currentPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length; i++) {
          ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
        }
        ctx.stroke();
      } else if (startPoint && cursorPos) {
        if (currentTool === 'rectangle') {
          ctx.strokeRect(startPoint.x, startPoint.y, cursorPos.x - startPoint.x, cursorPos.y - startPoint.y);
        } else if (currentTool === 'circle') {
          const radius = Math.hypot(cursorPos.x - startPoint.x, cursorPos.y - startPoint.y);
          ctx.beginPath();
          ctx.arc(startPoint.x, startPoint.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }, [elements, isDrawing, currentPoints, startPoint, cursorPos, currentTool, selectedColor, strokeWidth]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPoint(coords);
    setCursorPos(coords);

    if (currentTool === 'pencil') {
      setCurrentPoints([coords]);
    } else if (currentTool === 'sticky') {
      const text = prompt('Enter note content:') || 'Quick Note';
      const newElement: WhiteboardElement = {
        id: `el-${Date.now()}`,
        type: 'sticky',
        x: coords.x,
        y: coords.y,
        text,
        color: selectedColor,
        strokeWidth,
        authorId: currentUser.id,
        authorName: currentUser.name,
        createdAt: new Date().toISOString(),
      };
      pushState([...elements, newElement]);
      setIsDrawing(false);
    } else if (currentTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        const newElement: WhiteboardElement = {
          id: `el-${Date.now()}`,
          type: 'text',
          x: coords.x,
          y: coords.y,
          text,
          color: selectedColor,
          strokeWidth: Math.max(strokeWidth, 2),
          authorId: currentUser.id,
          authorName: currentUser.name,
          createdAt: new Date().toISOString(),
        };
        pushState([...elements, newElement]);
      }
      setIsDrawing(false);
    } else if (currentTool === 'eraser') {
      // Find element near click and remove
      const updated = elements.filter(el => {
        if (el.x !== undefined && el.y !== undefined) {
          return Math.hypot(el.x - coords.x, el.y - coords.y) > 30;
        }
        return true;
      });
      if (updated.length !== elements.length) {
        pushState(updated);
      }
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    setCursorPos(coords);

    if (!isDrawing) return;

    if (currentTool === 'pencil') {
      setCurrentPoints(prev => [...prev, coords]);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentTool === 'pencil' && currentPoints.length > 1) {
      const newElement: WhiteboardElement = {
        id: `el-${Date.now()}`,
        type: 'path',
        points: currentPoints,
        color: selectedColor,
        strokeWidth,
        authorId: currentUser.id,
        authorName: currentUser.name,
        createdAt: new Date().toISOString(),
      };
      pushState([...elements, newElement]);
      setCurrentPoints([]);
    } else if ((currentTool === 'rectangle' || currentTool === 'circle') && startPoint && cursorPos) {
      const width = cursorPos.x - startPoint.x;
      const height = cursorPos.y - startPoint.y;
      if (Math.abs(width) > 5 || Math.abs(height) > 5) {
        const newElement: WhiteboardElement = {
          id: `el-${Date.now()}`,
          type: currentTool,
          x: startPoint.x,
          y: startPoint.y,
          width,
          height,
          color: selectedColor,
          strokeWidth,
          authorId: currentUser.id,
          authorName: currentUser.name,
          createdAt: new Date().toISOString(),
        };
        pushState([...elements, newElement]);
      }
    }
    setStartPoint(null);
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-lg overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between p-3 border-b-2 border-black bg-slate-50 gap-2">
        {/* Tools Selector */}
        <div className="flex items-center gap-1 bg-white p-1 rounded border-2 border-black">
          <button
            onClick={() => setCurrentTool('pencil')}
            className={`p-2 rounded font-mono text-xs font-bold transition-all ${
              currentTool === 'pencil' ? 'bg-lime text-black border-2 border-black' : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Freehand Pencil"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => setCurrentTool('rectangle')}
            className={`p-2 rounded font-mono text-xs font-bold transition-all ${
              currentTool === 'rectangle' ? 'bg-lime text-black border-2 border-black' : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Rectangle"
          >
            <Square size={16} />
          </button>
          <button
            onClick={() => setCurrentTool('circle')}
            className={`p-2 rounded font-mono text-xs font-bold transition-all ${
              currentTool === 'circle' ? 'bg-lime text-black border-2 border-black' : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Circle"
          >
            <Circle size={16} />
          </button>
          <button
            onClick={() => setCurrentTool('text')}
            className={`p-2 rounded font-mono text-xs font-bold transition-all ${
              currentTool === 'text' ? 'bg-lime text-black border-2 border-black' : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Text Tool"
          >
            <Type size={16} />
          </button>
          <button
            onClick={() => setCurrentTool('sticky')}
            className={`p-2 rounded font-mono text-xs font-bold transition-all ${
              currentTool === 'sticky' ? 'bg-lime text-black border-2 border-black' : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Sticky Note"
          >
            <StickyNote size={16} />
          </button>
          <button
            onClick={() => setCurrentTool('eraser')}
            className={`p-2 rounded font-mono text-xs font-bold transition-all ${
              currentTool === 'eraser' ? 'bg-lime text-black border-2 border-black' : 'hover:bg-gray-100 text-gray-700'
            }`}
            title="Eraser"
          >
            <Eraser size={16} />
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded border-2 border-black">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                selectedColor === c ? 'scale-125 border-black ring-2 ring-lime' : 'border-gray-300'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="h-5 w-px bg-gray-300 mx-1" />
          <select
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="text-xs font-mono border-2 border-black rounded px-1 py-0.5 bg-white"
          >
            <option value={2}>Thin (2px)</option>
            <option value={4}>Med (4px)</option>
            <option value={8}>Thick (8px)</option>
          </select>
        </div>

        {/* Actions & Presence */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-gray-100 disabled:opacity-40"
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-gray-100 disabled:opacity-40"
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 border-2 border-black rounded bg-red-100 text-red-700 hover:bg-red-200"
            title="Clear Canvas"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={handleExportPNG}
            className="p-1.5 border-2 border-black rounded bg-white hover:bg-gray-100 text-black font-mono text-xs flex items-center gap-1 font-bold"
            title="Export PNG"
          >
            <Download size={14} /> PNG
          </button>

          {/* Active Collaborators count badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 bg-lime border-2 border-black rounded font-mono text-xs font-bold">
            <Users size={14} />
            <span>{activeUsers.length} Online</span>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Floating Remote User Cursors */}
        {activeUsers
          .filter((u) => u.id !== currentUser.id && u.cursor)
          .map((u) => (
            <div
              key={u.id}
              className="absolute pointer-events-none transition-all duration-75 flex items-center gap-1"
              style={{
                left: `${u.cursor?.x}px`,
                top: `${u.cursor?.y}px`,
              }}
            >
              <div
                className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: u.color }}
              />
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow"
                style={{ backgroundColor: u.color }}
              >
                {u.name}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
