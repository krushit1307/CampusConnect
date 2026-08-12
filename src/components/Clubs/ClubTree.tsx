import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { useClubTree, ClubHierarchyNode } from "@/hooks/useClubTree";
import { ClubTreeNode } from "./ClubTreeNode";

const nodeTypes = {
  clubNode: ClubTreeNode,
};

// Layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 270;
const nodeHeight = 150;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "TB") => {
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: "top" as any,
      sourcePosition: "bottom" as any,
      // Shift to top-left for React Flow
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

export function ClubTree() {
  const { data: clubs, isLoading, error } = useClubTree();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!clubs) return;

    // A helper to determine if a node should be visible
    // A node is visible if it's depth 0 OR if its parent is in expandedIds (recursively true)
    const isVisible = (clubId: string): boolean => {
      const club = clubs.find((c) => c.id === clubId);
      if (!club) return false;
      if (club.depth === 0) return true;
      if (!club.parent_club_id) return true;
      if (!expandedIds.has(club.parent_club_id)) return false;
      return isVisible(club.parent_club_id);
    };

    const visibleClubs = clubs.filter((c) => isVisible(c.id));

    // Build raw nodes
    const rawNodes: Node[] = visibleClubs.map((club) => {
      const children = clubs.filter((c) => c.parent_club_id === club.id);
      const hasChildren = children.length > 0;
      return {
        id: club.id,
        type: "clubNode",
        position: { x: 0, y: 0 },
        data: {
          id: club.id,
          name: club.name,
          logoUrl: club.logo_url,
          presidentName: club.president_name,
          hasChildren,
          isExpanded: expandedIds.has(club.id),
          onToggleExpand: toggleExpand,
        },
      };
    });

    // Build raw edges
    const rawEdges: Edge[] = [];
    visibleClubs.forEach((club) => {
      if (club.parent_club_id && visibleClubs.find((c) => c.id === club.parent_club_id)) {
        rawEdges.push({
          id: `e-${club.parent_club_id}-${club.id}`,
          source: club.parent_club_id,
          target: club.id,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#000", strokeWidth: 2 },
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [clubs, expandedIds, setNodes, setEdges, toggleExpand]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10 font-mono text-xl">
        Loading organizational chart...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-10 font-mono text-red-500">
        Failed to load chart: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="h-[80vh] w-full border-4 border-black bg-brand-gray-light-100">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        nodesDraggable={true}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#000" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            return "#ccff00"; // lime color for minimap nodes
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
