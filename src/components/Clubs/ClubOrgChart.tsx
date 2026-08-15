import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildClubOrgTree, type ClubOrgMember, type ClubOrgRole } from "@/lib/clubOrgChart";

interface ClubOrgChartProps {
  roles: ClubOrgRole[];
  members: ClubOrgMember[];
}

type RoleNodeData = {
  role: ClubOrgRole;
  members: ClubOrgMember[];
  hasChildren: boolean;
  expanded: boolean;
  cycleDetected: boolean;
  onToggle: (roleId: string) => void;
  onSelect: (member: ClubOrgMember) => void;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function RoleNode({ data }: NodeProps<Node<RoleNodeData>>) {
  const lead = data.members[0];
  return (
    <div
      className={`min-w-[210px] border-2 border-black bg-white p-3 shadow-[4px_4px_0_0_#000] ${data.cycleDetected ? "border-red-600" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-black" />
      <p className="font-mono text-[10px] font-black uppercase tracking-wider text-black/60">
        Role
      </p>
      <p className="mt-1 font-display text-lg font-black">{data.role.title}</p>
      {lead ? (
        <button
          type="button"
          onClick={() => data.onSelect(lead)}
          className="mt-3 flex w-full items-center gap-2 text-left hover:underline"
        >
          <Avatar className="h-8 w-8 border-2 border-black">
            <AvatarImage src={lead.avatar_url || undefined} alt={lead.name} />
            <AvatarFallback>{initials(lead.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate font-mono text-xs font-bold">{lead.name}</span>
        </button>
      ) : (
        <p className="mt-3 font-mono text-xs text-black/60">Open role</p>
      )}
      {data.members.length > 1 && (
        <p className="mt-2 font-mono text-[10px] text-black/60">
          +{data.members.length - 1} additional member(s)
        </p>
      )}
      {data.hasChildren && (
        <button
          type="button"
          onClick={() => data.onToggle(data.role.id)}
          className="mt-3 w-full border-2 border-black bg-lime px-2 py-1 font-mono text-[10px] font-black uppercase hover:bg-black hover:text-white"
        >
          {data.expanded ? "Collapse committee" : "Expand committee"}
        </button>
      )}
      {data.cycleDetected && (
        <p className="mt-2 font-mono text-[10px] font-black uppercase text-red-600">
          Cycle safely isolated
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-black" />
    </div>
  );
}

const nodeTypes = { role: RoleNode };

export function ClubOrgChart({ roles, members }: ClubOrgChartProps) {
  const tree = useMemo(() => buildClubOrgTree(roles, members), [roles, members]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tree.roots.map((roleId) => [roleId, true])),
  );
  const [selectedMember, setSelectedMember] = useState<ClubOrgMember | null>(null);

  const visibleRoleIds = useMemo(() => {
    const result = new Set<string>();
    const visit = (roleId: string, visible: boolean) => {
      if (!visible || result.has(roleId)) return;
      result.add(roleId);
      const isExpanded = expanded[roleId] ?? false;
      for (const childId of tree.childrenByRole[roleId] || []) visit(childId, isExpanded);
    };
    tree.roots.forEach((rootId) => visit(rootId, true));
    return result;
  }, [expanded, tree]);

  const { nodes, edges } = useMemo(() => {
    const visible = [...visibleRoleIds];
    const nodes: Node<RoleNodeData>[] = visible.map((roleId, index) => {
      const role = roles.find((candidate) => candidate.id === roleId)!;
      return {
        id: roleId,
        type: "role",
        position: { x: (index % 4) * 270, y: Math.floor(index / 4) * 230 },
        data: {
          role,
          members: tree.membersByRole[roleId] || [],
          hasChildren: (tree.childrenByRole[roleId] || []).length > 0,
          expanded: expanded[roleId] ?? false,
          cycleDetected: tree.cycleRoleIds.includes(roleId),
          onToggle: (id: string) => setExpanded((current) => ({ ...current, [id]: !current[id] })),
          onSelect: setSelectedMember,
        },
      };
    });
    const edges: Edge[] = [];
    for (const parentId of visible) {
      for (const childId of tree.childrenByRole[parentId] || []) {
        if (visibleRoleIds.has(childId)) {
          edges.push({
            id: `${parentId}-${childId}`,
            source: parentId,
            target: childId,
            animated: false,
            style: { stroke: "#000", strokeWidth: 2 },
          });
        }
      }
    }
    return { nodes, edges };
  }, [expanded, roles, tree, visibleRoleIds]);

  if (roles.length === 0) return null;

  return (
    <section className="mb-8 border-2 border-black bg-cream p-4 shadow-[6px_6px_0_0_#000]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-wider">
            Who reports to whom
          </p>
          <h2 className="font-display text-2xl font-black uppercase">Club Organization</h2>
          <p className="mt-1 max-w-2xl font-mono text-xs text-black/70">
            Committees start collapsed to keep large clubs readable. Drag the canvas to explore.
          </p>
        </div>
        {(tree.cycleRoleIds.length > 0 || tree.orphanRoleIds.length > 0) && (
          <div className="max-w-sm border-2 border-red-600 bg-red-50 p-3 font-mono text-xs text-red-700">
            Some role relationships are invalid. The chart isolated {tree.cycleRoleIds.length}{" "}
            cycle-related role(s) and {tree.orphanRoleIds.length} orphan role(s) so the page remains
            safe.
          </div>
        )}
      </div>
      <div className="h-[560px] border-2 border-black bg-white">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.25}
          maxZoom={1.5}
        >
          <Background gap={24} color="#d4d4d4" />
          <Controls />
          <MiniMap nodeColor="#bef264" />
        </ReactFlow>
      </div>

      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedMember.name} profile`}
        >
          <div className="w-full max-w-md border-2 border-black bg-cream p-6 shadow-[8px_8px_0_0_#000]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border-2 border-black">
                  <AvatarImage
                    src={selectedMember.avatar_url || undefined}
                    alt={selectedMember.name}
                  />
                  <AvatarFallback>{initials(selectedMember.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-display text-2xl font-black">{selectedMember.name}</h3>
                  <p className="font-mono text-xs font-bold uppercase text-black/60">
                    {selectedMember.role_title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="border-2 border-black bg-white px-2 py-1 font-mono text-xs font-black"
              >
                Close
              </button>
            </div>
            {selectedMember.bio && (
              <p className="mt-5 border-l-4 border-black pl-3 text-sm leading-6">
                {selectedMember.bio}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              {selectedMember.handle && (
                <Link
                  to={`/profile/${selectedMember.handle}`}
                  className="border-2 border-black bg-lime px-4 py-2 font-mono text-xs font-black uppercase"
                >
                  View profile
                </Link>
              )}
              <Link
                to={`/messages/new?recipient=${encodeURIComponent(selectedMember.user_id)}`}
                className="border-2 border-black bg-white px-4 py-2 font-mono text-xs font-black uppercase"
              >
                Message Me
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
