import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState 
} from 'reactflow';
import 'reactflow/dist/style.css';

export default function OrgChartEditor({ clubId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    fetch(`/api/clubs/${clubId}/org-chart`)
      .then((res) => res.json())
      .then((data) => {
        // Flatten recursive tree into React Flow nodes and edges with automatic layout
        const { flowNodes, flowEdges } = parseTreeToFlow(data.org_chart);
        setNodes(flowNodes);
        setEdges(flowEdges);
      });
  }, [clubId, setNodes, setEdges]);

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);

  const handleSave = async () => {
    const roleUpdates = edges.map((edge) => ({
      role_id: parseInt(edge.target),
      reports_to_role_id: parseInt(edge.source),
    }));

    await fetch(`/api/clubs/${clubId}/org-chart`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: roleUpdates }),
    });
    alert('Hierarchy successfully saved!');
  };

  return (
    <div className="h-[600px] w-full border rounded-lg bg-slate-50 relative">
      <div className="absolute top-4 right-4 z-10">
        <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded shadow">
          Save Hierarchy
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function parseTreeToFlow(tree, parentId = null, depth = 0, index = 0, nodes = [], edges = []) {
  tree.forEach((node, idx) => {
    const x = (idx - tree.length / 2) * 250 + (index * 50);
    const y = depth * 150 + 50;

    nodes.push({
      id: node.id.toString(),
      data: { label: `${node.title}\n(${node.user.name})` },
      position: { x, y },
      style: { background: '#fff', border: '1px solid #cbd5e1', padding: 10, borderRadius: 8 },
    });

    if (parentId) {
      edges.push({
        id: `e-${parentId}-${node.id}`,
        source: parentId.toString(),
        target: node.id.toString(),
        type: 'smoothstep',
      });
    }

    if (node.children && node.children.length > 0) {
      parseTreeToFlow(node.children, node.id, depth + 1, idx, nodes, edges);
    }
  });
  return { flowNodes: nodes, flowEdges: edges };
}
