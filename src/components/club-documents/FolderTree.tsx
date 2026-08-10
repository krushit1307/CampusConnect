import { useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Pencil,
  File,
  MoreHorizontal,
} from "lucide-react";
import type { ClubDocument, FolderTreeNode } from "@/hooks/useClubDocuments";

interface FolderTreeProps {
  tree: FolderTreeNode[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onMoveFolder: (folderId: string, parentId: string | null, orderIndex: number) => void;
  onCreateSubfolder: (parentId: string, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteDocument: (doc: ClubDocument) => void;
  isAdmin: boolean;
}

function FolderNode({
  node,
  depth,
  selectedFolderId,
  onSelectFolder,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteDocument,
  isAdmin,
}: {
  node: FolderTreeNode;
  depth: number;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateSubfolder: (parentId: string, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteDocument: (doc: ClubDocument) => void;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  const hasChildren = node.children.length > 0 || node.documents.length > 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 px-1 py-1 cursor-pointer rounded group hover:bg-gray-100 ${
          selectedFolderId === node.id ? "bg-lime font-bold" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-0.5 hover:bg-gray-200 rounded"
        >
          {expanded && hasChildren ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className={`h-3.5 w-3.5 ${!hasChildren ? "invisible" : ""}`} />
          )}
        </button>
        <button
          onClick={() => onSelectFolder(node.id)}
          className="flex items-center gap-1.5 flex-1 text-left"
        >
          {expanded ? (
            <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-amber-500 shrink-0" />
          )}
          <span className="font-mono text-xs truncate">{node.name}</span>
        </button>
        {isAdmin && (
          <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-36 bg-white border-2 border-black shadow-[3px_3px_0_0_#000]">
                <button
                  onClick={() => {
                    const name = prompt("Folder name:");
                    if (name?.trim()) onCreateSubfolder(node.id, name.trim());
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 font-mono text-xs text-left hover:bg-gray-100 flex items-center gap-2"
                >
                  <Plus className="h-3 w-3" /> New Subfolder
                </button>
                <button
                  onClick={() => {
                    const name = prompt("New name:", node.name);
                    if (name?.trim()) onRenameFolder(node.id, name.trim());
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 font-mono text-xs text-left hover:bg-gray-100 flex items-center gap-2"
                >
                  <Pencil className="h-3 w-3" /> Rename
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete folder "${node.name}" and all contents?`)) {
                      onDeleteFolder(node.id);
                    }
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 font-mono text-xs text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <Droppable droppableId={node.id}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {node.children.map((child, index) => (
                <Draggable key={child.id} draggableId={child.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={snapshot.isDragging ? "opacity-70" : ""}
                    >
                      <FolderNode
                        node={child}
                        depth={depth + 1}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={onSelectFolder}
                        onCreateSubfolder={onCreateSubfolder}
                        onRenameFolder={onRenameFolder}
                        onDeleteFolder={onDeleteFolder}
                        onDeleteDocument={onDeleteDocument}
                        isAdmin={isAdmin}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {node.documents.map((doc, index) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-gray-50 group"
                  style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}
                >
                  <File className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs truncate flex-1 hover:underline text-blue-600"
                  >
                    {doc.name}
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => onDeleteDocument(doc)}
                      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
}

export function FolderTree({
  tree,
  selectedFolderId,
  onSelectFolder,
  onMoveFolder,
  onCreateSubfolder,
  onRenameFolder,
  onDeleteFolder,
  onDeleteDocument,
  isAdmin,
}: FolderTreeProps) {
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index)
        return;

      const destFolderId = destination.droppableId === "root" ? null : destination.droppableId;

      const newOrder = destination.index * 1000;
      onMoveFolder(draggableId, destFolderId, newOrder);
    },
    [onMoveFolder],
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="font-mono text-sm">
        <div
          className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded hover:bg-gray-100 ${
            selectedFolderId === null ? "bg-lime font-bold" : ""
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <Folder className="h-4 w-4 text-amber-500" />
          <span className="text-xs">All Documents</span>
        </div>
        <Droppable droppableId="root">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {tree.map((node, index) => (
                <Draggable key={node.id} draggableId={node.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={snapshot.isDragging ? "opacity-70" : ""}
                    >
                      <FolderNode
                        node={node}
                        depth={0}
                        selectedFolderId={selectedFolderId}
                        onSelectFolder={onSelectFolder}
                        onCreateSubfolder={onCreateSubfolder}
                        onRenameFolder={onRenameFolder}
                        onDeleteFolder={onDeleteFolder}
                        onDeleteDocument={onDeleteDocument}
                        isAdmin={isAdmin}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </DragDropContext>
  );
}
