import React, { useState } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Mail,
  UserCheck,
  ChevronDown,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  ClubOrgNode,
  buildOrgHierarchyTree,
  updateNodeReportsTo,
  calculateOrgStats,
  getDepartmentBadgeColor,
} from "@/lib/clubOrgChart";
import { cn } from "@/lib/utils";

export interface ClubOrgChartProps {
  clubId?: string;
  clubName?: string;
  isAdmin?: boolean;
  initialNodes?: ClubOrgNode[];
  onSaveNode?: (node: ClubOrgNode) => void;
  onDeleteNode?: (nodeId: string) => void;
  className?: string;
}

export const MOCK_INITIAL_ORG_NODES: ClubOrgNode[] = [
  {
    id: "node-pres",
    club_id: "club-cs-1",
    title: "President",
    name: "Alex Rivera",
    department: "Executive Board",
    reports_to_id: null,
    email: "alex.pres@campus.edu",
    bio: "Senior CS major passionate about developer advocacy and hackathon community building.",
  },
  {
    id: "node-vp-eng",
    club_id: "club-cs-1",
    title: "VP of Engineering",
    name: "Sam Chen",
    department: "Engineering",
    reports_to_id: "node-pres",
    email: "sam.tech@campus.edu",
    bio: "Manages club software infrastructure, web apps, and Discord automation bot.",
  },
  {
    id: "node-vp-mkt",
    club_id: "club-cs-1",
    title: "VP of Marketing",
    name: "Taylor Swift",
    department: "Marketing",
    reports_to_id: "node-pres",
    email: "taylor.mkt@campus.edu",
    bio: "Directs campus publicity campaigns, club newsletters, and social media.",
  },
  {
    id: "node-dir-frontend",
    club_id: "club-cs-1",
    title: "Director of Frontend",
    name: "Jordan Lee",
    department: "Engineering",
    reports_to_id: "node-vp-eng",
    email: "jordan.front@campus.edu",
    bio: "Leads React/Tailwind frontend workshop tracks and mentored 50+ freshmen.",
  },
  {
    id: "node-dir-events",
    club_id: "club-cs-1",
    title: "Director of Social Events",
    name: "Morgan Bailey",
    department: "Events",
    reports_to_id: "node-vp-mkt",
    email: "morgan.events@campus.edu",
    bio: "Organizes tech speaker banquets, study sessions, and alumni galas.",
  },
];

export const ClubOrgChart: React.FC<ClubOrgChartProps> = ({
  clubId = "club-cs-1",
  clubName = "Computer Science Society",
  isAdmin = true,
  initialNodes = MOCK_INITIAL_ORG_NODES,
  onSaveNode,
  onDeleteNode,
  className,
}) => {
  const [nodes, setNodes] = useState<ClubOrgNode[]>(initialNodes);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("All");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [inspectingNode, setInspectingNode] = useState<ClubOrgNode | null>(null);

  // Add / Edit Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingNode, setEditingNode] = useState<ClubOrgNode | null>(null);
  const [formName, setFormName] = useState<string>("");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDept, setFormDept] = useState<string>("Executive Board");
  const [formReportsTo, setFormReportsTo] = useState<string>("");
  const [formEmail, setFormEmail] = useState<string>("");
  const [formBio, setFormBio] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const stats = calculateOrgStats(nodes);
  const tree = buildOrgHierarchyTree(nodes);

  const handleOpenAddModal = (nodeToEdit?: ClubOrgNode) => {
    if (nodeToEdit) {
      setEditingNode(nodeToEdit);
      setFormName(nodeToEdit.name);
      setFormTitle(nodeToEdit.title);
      setFormDept(nodeToEdit.department || "Executive Board");
      setFormReportsTo(nodeToEdit.reports_to_id || "");
      setFormEmail(nodeToEdit.email || "");
      setFormBio(nodeToEdit.bio || "");
    } else {
      setEditingNode(null);
      setFormName("");
      setFormTitle("");
      setFormDept("Executive Board");
      setFormReportsTo(nodes[0]?.id || "");
      setFormEmail("");
      setFormBio("");
    }
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formTitle.trim()) return;

    if (editingNode) {
      // Validate cycle
      if (formReportsTo) {
        const updateResult = updateNodeReportsTo(nodes, editingNode.id, formReportsTo || null);
        if (!updateResult.success) {
          setFormError(updateResult.error || "Invalid hierarchy link");
          return;
        }
      }

      const updatedNodes = nodes.map((n) =>
        n.id === editingNode.id
          ? {
              ...n,
              name: formName.trim(),
              title: formTitle.trim(),
              department: formDept,
              reports_to_id: formReportsTo || null,
              email: formEmail.trim() || undefined,
              bio: formBio.trim() || undefined,
            }
          : n
      );
      setNodes(updatedNodes);
      if (onSaveNode) {
        const target = updatedNodes.find((n) => n.id === editingNode.id);
        if (target) onSaveNode(target);
      }
    } else {
      const newNode: ClubOrgNode = {
        id: `node-${Date.now()}`,
        club_id: clubId,
        name: formName.trim(),
        title: formTitle.trim(),
        department: formDept,
        reports_to_id: formReportsTo || null,
        email: formEmail.trim() || undefined,
        bio: formBio.trim() || undefined,
      };
      const updated = [...nodes, newNode];
      setNodes(updated);
      if (onSaveNode) onSaveNode(newNode);
    }

    setShowAddModal(false);
  };

  const handleDeleteNode = (nodeId: string) => {
    const target = nodes.find((n) => n.id === nodeId);
    const parentId = target?.reports_to_id || null;

    // Re-parent children to target's parent to keep hierarchy intact
    const updated = nodes
      .filter((n) => n.id !== nodeId)
      .map((n) => (n.reports_to_id === nodeId ? { ...n, reports_to_id: parentId } : n));

    setNodes(updated);
    if (onDeleteNode) onDeleteNode(nodeId);
    if (inspectingNode?.id === nodeId) setInspectingNode(null);
  };

  // Render a Node and its recursive subtree
  const renderTreeNode = (node: ClubOrgNode, level: number = 1) => {
    const isFiltered =
      selectedDepartment !== "All" && node.department !== selectedDepartment;
    const badgeStyle = getDepartmentBadgeColor(node.department);
    const directReportsCount = node.children ? node.children.length : 0;

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Node Card */}
        <div
          onClick={() => setInspectingNode(node)}
          className={cn(
            "p-3.5 border-2 border-black rounded-xl bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] w-60 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] relative space-y-2",
            isFiltered ? "opacity-40 grayscale" : "opacity-100"
          )}
        >
          {/* Department Badge */}
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                badgeStyle.bgClass,
                badgeStyle.borderClass,
                badgeStyle.textClass
              )}
            >
              {node.department || "Executive"}
            </span>

            {directReportsCount > 0 && (
              <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300">
                {directReportsCount} reports
              </span>
            )}
          </div>

          <div>
            <h5 className="font-bold text-xs text-black leading-tight">{node.title}</h5>
            <p className="text-xs font-sans text-gray-700 font-medium">{node.name}</p>
          </div>

          {isAdmin && (
            <div
              className="flex items-center justify-end gap-1 pt-1 border-t border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => handleOpenAddModal(node)}
                className="p-1 text-gray-600 hover:text-black hover:bg-gray-100 rounded"
                title="Edit role"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNode(node.id)}
                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                title="Delete role"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Children Branches */}
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col items-center">
            {/* Vertical stem line down from parent */}
            <div className="w-0.5 h-6 bg-black" />

            {/* Horizontal branch bar across all children */}
            <div className="flex items-start justify-center relative">
              {node.children.map((child, idx) => (
                <div key={child.id} className="flex flex-col items-center px-4 relative">
                  {/* Stem line up to branch */}
                  <div className="w-0.5 h-6 bg-black" />
                  {renderTreeNode(child, level + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-purple-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-purple-950">
            <Users className="w-5 h-5 text-purple-700" />
            <span>Interactive Leadership Hierarchy & Org Chart — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Visual governance tree showing executive reporting structures, officer positions, and committee leads.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Leadership Role
          </button>
        )}
      </div>

      {/* Control Bar: Department Filters & Zoom Controls */}
      <div className="p-3.5 bg-slate-50 border-b-2 border-black flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Department Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-gray-700 uppercase mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Dept:
          </span>
          {["All", ...stats.departments].map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDepartment(dept)}
              className={cn(
                "px-2.5 py-1 rounded-md border text-xs font-bold transition-colors",
                selectedDepartment === dept
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-500"
              )}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* Stats & Zoom */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-1 rounded border border-purple-300">
            {stats.totalMembers} Leaders • {stats.maxHierarchyDepth} Tiers
          </span>

          <div className="flex items-center gap-1 bg-white border border-black rounded p-0.5">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
              className="p-1 hover:bg-gray-100 rounded text-gray-700"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold px-1">{Math.round(zoomLevel * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.3, z + 0.1))}
              className="p-1 hover:bg-gray-100 rounded text-gray-700"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1 hover:bg-gray-100 rounded text-gray-700"
              title="Reset zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas: Org Chart Tree */}
      <div className="p-8 bg-slate-100/60 overflow-x-auto min-h-[380px] flex justify-center items-start">
        <div
          className="transition-transform duration-200 origin-top flex flex-col items-center gap-8"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {tree.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-gray-300 rounded-xl text-xs text-gray-500">
              No leadership roles registered. Click "Add Leadership Role" to build the org chart.
            </div>
          ) : (
            <div className="flex items-start justify-center gap-10">
              {tree.map((root) => renderTreeNode(root, 1))}
            </div>
          )}
        </div>
      </div>

      {/* Inspect Executive Modal Drawer (#3609) */}
      {inspectingNode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black rounded-xl max-w-md w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] font-mono">
            <div className="flex items-start justify-between border-b-2 border-black pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                  {inspectingNode.department || "Executive"}
                </span>
                <h3 className="font-bold text-base text-black mt-1">{inspectingNode.name}</h3>
                <p className="text-xs text-gray-600 font-sans">{inspectingNode.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingNode(null)}
                className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 font-sans text-xs">
              {inspectingNode.bio && (
                <div>
                  <h5 className="font-bold font-mono uppercase text-gray-500 text-[11px] mb-1">
                    Leadership Bio
                  </h5>
                  <p className="text-gray-800 bg-slate-50 p-3 rounded border border-gray-200 leading-relaxed">
                    {inspectingNode.bio}
                  </p>
                </div>
              )}

              {inspectingNode.email && (
                <div>
                  <h5 className="font-bold font-mono uppercase text-gray-500 text-[11px] mb-1">
                    Contact Email
                  </h5>
                  <a
                    href={`mailto:${inspectingNode.email}`}
                    className="text-purple-700 underline font-medium flex items-center gap-1 hover:text-purple-900"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {inspectingNode.email}
                  </a>
                </div>
              )}

              {inspectingNode.children && inspectingNode.children.length > 0 && (
                <div>
                  <h5 className="font-bold font-mono uppercase text-gray-500 text-[11px] mb-1">
                    Direct Reports ({inspectingNode.children.length})
                  </h5>
                  <div className="space-y-1.5">
                    {inspectingNode.children.map((child) => (
                      <div
                        key={child.id}
                        className="p-2 border border-gray-200 rounded bg-gray-50 flex items-center justify-between"
                      >
                        <span className="font-bold text-gray-800">{child.name}</span>
                        <span className="text-gray-500 text-[11px]">{child.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Leadership Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveNode}
            className="bg-white border-2 border-black rounded-xl max-w-lg w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] overflow-auto font-mono"
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-base uppercase flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                {editingNode ? "Edit Leadership Role" : "Add New Leadership Role"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
              >
                Close
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-100 border-2 border-rose-400 text-rose-900 rounded text-xs font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="org-name-input" className="text-xs font-bold uppercase block mb-1">
                  Executive / Member Name *
                </label>
                <input
                  id="org-name-input"
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>

              <div>
                <label htmlFor="org-title-input" className="text-xs font-bold uppercase block mb-1">
                  Leadership Position / Role Title *
                </label>
                <input
                  id="org-title-input"
                  type="text"
                  required
                  placeholder="e.g. Director of Marketing & Social Media"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="org-dept-input" className="text-xs font-bold uppercase block mb-1">
                    Department
                  </label>
                  <select
                    id="org-dept-input"
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                  >
                    <option value="Executive Board">Executive Board</option>
                    <option value="Engineering">Engineering & Tech</option>
                    <option value="Marketing">Marketing & Comms</option>
                    <option value="Finance">Finance & Sponsorship</option>
                    <option value="Events">Events & Logistics</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="org-reports-to-select" className="text-xs font-bold uppercase block mb-1">
                    Reports To (Parent Manager)
                  </label>
                  <select
                    id="org-reports-to-select"
                    value={formReportsTo}
                    onChange={(e) => setFormReportsTo(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                  >
                    <option value="">(None - Top Level President)</option>
                    {nodes
                      .filter((n) => !editingNode || n.id !== editingNode.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title} ({n.name})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="org-email-input" className="text-xs font-bold uppercase block mb-1">
                  Contact Email
                </label>
                <input
                  id="org-email-input"
                  type="email"
                  placeholder="leader@campus.edu"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>

              <div>
                <label htmlFor="org-bio-input" className="text-xs font-bold uppercase block mb-1">
                  Role Bio & Responsibilities
                </label>
                <textarea
                  id="org-bio-input"
                  rows={2}
                  placeholder="Summary of responsibilities, office hours, and background..."
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t-2 border-black/10">
              <button
                type="submit"
                className="px-4 py-2 border-2 border-black bg-purple-600 text-white font-bold text-xs uppercase rounded-md hover:bg-purple-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Save Role
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
