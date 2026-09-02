'use client';

import { useState, useRef, useEffect } from 'react';
import { FacilityNode, FacilityNodeType } from '@/types/venue';
import { serializeFacilities, validateNodeBounds } from '@/lib/venue/serialization';

interface AccessibleNodeEditorProps {
    initialNodes: FacilityNode[];
    gridSize: number;
    onSave: (serializedData: string) => Promise<void>;
    canvasWidth: number;
    canvasHeight: number;
}

export default function AccessibleNodeEditor({
    initialNodes,
    gridSize,
    onSave,
    canvasWidth,
    canvasHeight
}: AccessibleNodeEditorProps) {
    const [nodes, setNodes] = useState<FacilityNode[]>(initialNodes);
    const [draggedType, setDraggedType] = useState<FacilityNodeType | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedType || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;

        // Snap to grid
        const snappedX = Math.round(rawX / gridSize) * gridSize;
        const snappedY = Math.round(rawY / gridSize) * gridSize;

        const newNode: FacilityNode = {
            id: crypto.randomUUID(),
            type: draggedType,
            x: snappedX,
            y: snappedY,
            rotation: 0,
            width: 60,
            height: 60,
        };

        if (validateNodeBounds(newNode, canvasWidth, canvasHeight)) {
            setNodes(prev => [...prev, newNode]);
        }
        setDraggedType(null);
    };

    const handleNodeDrag = (id: string, deltaX: number, deltaY: number) => {
        setNodes(prev => prev.map(node => {
            if (node.id === id) {
                const newX = Math.round((node.x + deltaX) / gridSize) * gridSize;
                const newY = Math.round((node.y + deltaY) / gridSize) * gridSize;

                const testNode = { ...node, x: newX, y: newY };
                if (validateNodeBounds(testNode, canvasWidth, canvasHeight)) {
                    return testNode;
                }
            }
            return node;
        }));
    };

    const handleRotate = (id: string, deltaRotation: number) => {
        setNodes(prev => prev.map(node => {
            if (node.id === id) {
                return {
                    ...node,
                    rotation: Math.round((node.rotation + deltaRotation) / 15) * 15
                };
            }
            return node;
        }));
    };

    const handleDelete = (id: string) => {
        setNodes(prev => prev.filter(node => node.id !== id));
        setSelectedNodeId(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const serialized = serializeFacilities(nodes, gridSize);
            await onSave(serialized);
        } catch (error) {
            console.error('Failed to save layout:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const getIconForType = (type: FacilityNodeType) => {
        switch (type) {
            case 'wheelchair_ramp': return '♿';
            case 'elevator': return '🛗';
            case 'accessible_restroom': return '🚻';
            case 'emergency_exit': return '🚪';
            default: return '📍';
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Layout Editor</h2>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save Layout'}
                </button>
            </div>

            <div
                ref={canvasRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="flex-1 bg-gray-100 dark:bg-gray-900 relative overflow-auto"
                style={{
                    backgroundImage: `linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)`,
                    backgroundSize: `${gridSize}px ${gridSize}px`,
                }}
            >
                <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
                    {nodes.map(node => (
                        <div
                            key={node.id}
                            onClick={() => setSelectedNodeId(node.id)}
                            className={`
                absolute flex items-center justify-center text-2xl cursor-move select-none
                border-2 transition-all duration-200
                ${selectedNodeId === node.id
                                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-lg'
                                    : 'border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-500'
                                }
              `}
                            style={{
                                left: node.x,
                                top: node.y,
                                width: node.width,
                                height: node.height,
                                transform: `rotate(${node.rotation}deg)`,
                            }}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', node.id);
                            }}
                            onDragEnd={(e) => {
                                const rect = canvasRef.current?.getBoundingClientRect();
                                if (rect) {
                                    const deltaX = e.clientX - rect.left - node.x - (node.width / 2);
                                    const deltaY = e.clientY - rect.top - node.y - (node.height / 2);
                                    handleNodeDrag(node.id, deltaX, deltaY);
                                }
                            }}
                        >
                            {getIconForType(node.type)}

                            {selectedNodeId === node.id && (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRotate(node.id, 15);
                                        }}
                                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white p-1 rounded-full hover:bg-blue-700"
                                        title="Rotate 15° clockwise"
                                    >
                                        ↻
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(node.id);
                                        }}
                                        className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                                        title="Delete node"
                                    >
                                        ✕
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
