import { Handle, Position } from "@xyflow/react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import User from "lucide-react/dist/esm/icons/user";
import { cn } from "@/lib/utils";

export interface ClubTreeNodeData {
  name: string;
  logoUrl: string | null;
  presidentName: string | null;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  id: string; // the node's club id
}

export function ClubTreeNode({ data }: { data: ClubTreeNodeData }) {
  return (
    <div className="relative flex w-64 flex-col items-center bg-white neu-border shadow-[4px_4px_0_0_#000] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000]">
      {/* Top Handle for incoming edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="h-3 w-3 border-2 border-black bg-lime"
      />

      {/* Header / Logo */}
      <div className="flex w-full items-center gap-3 border-b-2 border-black bg-brand-gray-light-100 p-3">
        {data.logoUrl ? (
          <img
            src={data.logoUrl}
            alt={`${data.name} logo`}
            className="h-10 w-10 border-2 border-black bg-white object-cover rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-white rounded-full">
            <span className="font-mono text-xs font-bold">{data.name.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <h3 className="truncate font-mono text-sm font-bold text-black" title={data.name}>
            {data.name}
          </h3>
        </div>
      </div>

      {/* Body / Info */}
      <div className="w-full p-3 text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          <User className="h-4 w-4" />
          <span className="truncate font-mono text-xs">{data.presidentName || "No President"}</span>
        </div>
      </div>

      {/* Expand/Collapse Footer */}
      {data.hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleExpand(data.id);
          }}
          className={cn(
            "flex w-full items-center justify-center gap-1 border-t-2 border-black py-2 font-mono text-xs font-bold transition-colors",
            data.isExpanded ? "bg-red-300 hover:bg-red-400" : "bg-lime hover:bg-lime/80",
          )}
        >
          {data.isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" /> Collapse
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" /> Expand
            </>
          )}
        </button>
      )}

      {/* Bottom Handle for outgoing edges */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="h-3 w-3 border-2 border-black bg-lime"
      />
    </div>
  );
}
