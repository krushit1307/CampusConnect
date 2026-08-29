import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, MessageSquare, Users, ZoomIn, ZoomOut } from "lucide-react";
import {
  buildOrgHierarchyTree,
  getDepartmentBadgeColor,
  type ClubOrgNode,
} from "@/lib/clubOrgChart";
import { normalizeClubHierarchy, type ClubHierarchyRow } from "@/lib/clubHierarchy";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function PublicClubOrgChart({ rows }: { rows: ClubHierarchyRow[] }) {
  const nodes = useMemo(() => normalizeClubHierarchy(rows), [rows]);
  const tree = useMemo(() => buildOrgHierarchyTree(nodes), [nodes]);
  const departments = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(nodes.map((node) => node.department).filter(Boolean) as string[]),
      ).sort(),
    ],
    [nodes],
  );
  const [department, setDepartment] = useState("All");
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<ClubOrgNode | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapsed = (nodeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const renderNode = (node: ClubOrgNode): JSX.Element => {
    const visible = department === "All" || node.department === department;
    const badge = getDepartmentBadgeColor(node.department);
    const isCollapsed = collapsed.has(node.id);
    const children = node.children ?? [];
    return (
      <div key={node.id} className="flex flex-col items-center">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelected(node)}
            aria-label={`View ${node.name}, ${node.title}`}
            className={`w-56 border-2 border-black bg-white p-3 text-left shadow-[3px_3px_0_0_#000] transition hover:-translate-y-1 hover:bg-lime ${visible ? "opacity-100" : "opacity-35 grayscale"}`}
          >
            <div className="flex items-start gap-2">
              <Avatar className="h-9 w-9 shrink-0 border-2 border-black">
                <AvatarImage src={node.avatar_url} alt="" />
                <AvatarFallback className="bg-brand-blue-light text-xs font-black text-black">
                  {node.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span
                  className={`inline-block border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${badge.bgClass} ${badge.borderClass} ${badge.textClass}`}
                >
                  {node.department || "Committee"}
                </span>
                <p className="mt-1 truncate font-display text-sm font-black text-black">
                  {node.title}
                </p>
                <p className="truncate font-mono text-[11px] text-gray-600">{node.name}</p>
              </div>
            </div>
          </button>
          {children.length > 0 && (
            <button
              type="button"
              onClick={() => toggleCollapsed(node.id)}
              className="border-2 border-black bg-white p-1 text-black"
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.name}'s reports`}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {!isCollapsed && children.length > 0 && (
          <div className="flex flex-col items-center">
            <div className="h-6 w-0.5 bg-black" />
            <div className="flex items-start justify-center">
              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center px-3">
                  <div className="h-5 w-0.5 bg-black" />
                  {renderNode(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      className="neu-border overflow-hidden bg-white shadow-[4px_4px_0_0_#000]"
      aria-labelledby="club-hierarchy-title"
    >
      <div className="flex flex-col justify-between gap-4 border-b-2 border-black bg-purple-100 p-5 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-purple-800">
            Meet the people behind the club
          </p>
          <h2
            id="club-hierarchy-title"
            className="mt-1 flex items-center gap-2 font-display text-2xl font-black uppercase text-purple-950"
          >
            <Users className="h-6 w-6" /> Leadership hierarchy
          </h2>
          <p className="mt-1 max-w-xl font-mono text-xs leading-5 text-gray-700">
            Explore reporting lines and find the right person for each committee. Select a node to
            view their role and start a secure message.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 border-2 border-black bg-white p-1">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.7, value - 0.1))}
            className="p-1 hover:bg-lime"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="px-1 font-mono text-[10px] font-bold">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(1.3, value + 0.1))}
            className="p-1 hover:bg-lime"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        className="flex flex-wrap gap-2 border-b-2 border-black bg-slate-50 p-3"
        aria-label="Filter leadership by department"
      >
        {departments.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setDepartment(item)}
            className={`border-2 border-black px-2 py-1 font-mono text-[10px] font-bold uppercase ${department === item ? "bg-black text-white" : "bg-white text-black hover:bg-lime"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="min-h-[260px] overflow-x-auto bg-slate-100/70 p-8">
        <div
          className="flex min-w-max justify-center gap-8 transition-transform"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
        >
          {tree.length === 0 ? (
            <p className="border-2 border-dashed border-gray-400 p-8 font-mono text-xs text-gray-600">
              This club has not published its leadership hierarchy yet.
            </p>
          ) : (
            tree.map(renderNode)
          )}
        </div>
      </div>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div
            className="neu-border w-full max-w-md bg-white p-6 shadow-[8px_8px_0_0_#000]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-node-title"
          >
            <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase text-purple-700">
                  {selected.department || "Committee"}
                </p>
                <h3 id="org-node-title" className="font-display text-xl font-black">
                  {selected.name}
                </h3>
                <p className="font-mono text-xs text-gray-600">{selected.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="border-2 border-black bg-white px-2 py-1 font-mono text-xs font-bold uppercase hover:bg-lime"
              >
                Close
              </button>
            </div>
            <p className="py-4 font-mono text-xs leading-5 text-gray-700">
              Contact this club leader through CampusConnect’s secure direct messages. Personal
              email addresses are not exposed on the public chart.
            </p>
            {selected.user_id && (
              <Link
                to={`/messages?userId=${encodeURIComponent(selected.user_id)}&message=${encodeURIComponent(`Hi ${selected.name}, I found you through the club hierarchy and would like to ask about ${selected.title}.`)}`}
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-2 border-2 border-black bg-lime px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0_0_#000] hover:bg-white"
              >
                <MessageSquare className="h-4 w-4" /> Message {selected.name.split(" ")[0]}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
