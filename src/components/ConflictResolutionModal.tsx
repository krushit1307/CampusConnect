import { useState } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventDocument, FieldConflict } from "@/lib/conflictResolution";

interface ConflictResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: FieldConflict[];
  mergedDocument: EventDocument;
  onResolve: (resolvedDocument: EventDocument) => void;
}

export function ConflictResolutionModal({
  open,
  onOpenChange,
  conflicts,
  mergedDocument,
  onResolve,
}: ConflictResolutionModalProps) {
  // Map of field -> selected choice ('local' | 'server' | 'custom')
  const [selections, setSelections] = useState<Record<string, "local" | "server" | "custom">>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const handleChoice = (field: string, choice: "local" | "server") => {
    setSelections((prev) => ({ ...prev, [field]: choice }));
  };

  const handleCustomChange = (field: string, val: string) => {
    setSelections((prev) => ({ ...prev, [field]: "custom" }));
    setCustomValues((prev) => ({ ...prev, [field]: val }));
  };

  const handleConfirmResolution = () => {
    const finalDoc = { ...mergedDocument };

    for (const conflict of conflicts) {
      const choice = selections[conflict.field] || "local";

      if (choice === "server") {
        finalDoc[conflict.field] = conflict.serverValue;
      } else if (choice === "custom") {
        finalDoc[conflict.field] = customValues[conflict.field] ?? conflict.localValue;
      } else {
        finalDoc[conflict.field] = conflict.localValue;
      }
    }

    onResolve(finalDoc);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="neu-border neu-shadow bg-cream sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
            <DialogTitle className="text-xl font-black text-foreground">
              Concurrent Edit Conflict Detected
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Another admin updated this event while you were editing. Non-conflicting changes and
            tags have been auto-merged. Please review and choose the winning values for the
            conflicting fields below:
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-4">
          {conflicts.map((conflict) => {
            const currentSelection = selections[conflict.field] || "local";

            return (
              <div
                key={conflict.field}
                className="rounded-lg border-2 border-black bg-white p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-mono font-bold uppercase text-foreground">
                    Field: {conflict.field}
                  </span>
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                    Conflict
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
                  {/* Local Edit Option */}
                  <button
                    type="button"
                    onClick={() => handleChoice(conflict.field, "local")}
                    className={`rounded-md border-2 p-3 text-left transition-all ${
                      currentSelection === "local"
                        ? "border-black bg-emerald-50 text-emerald-950 font-bold shadow-sm"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase text-emerald-800">
                        Your Local Edit
                      </span>
                      {currentSelection === "local" && (
                        <Check className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="mt-1 font-sans text-xs break-words">
                      {String(conflict.localValue ?? "(empty)")}
                    </p>
                  </button>

                  {/* Server Edit Option */}
                  <button
                    type="button"
                    onClick={() => handleChoice(conflict.field, "server")}
                    className={`rounded-md border-2 p-3 text-left transition-all ${
                      currentSelection === "server"
                        ? "border-black bg-blue-50 text-blue-950 font-bold shadow-sm"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase text-blue-800">
                        Server Edit (Other Admin)
                      </span>
                      {currentSelection === "server" && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                    <p className="mt-1 font-sans text-xs break-words">
                      {String(conflict.serverValue ?? "(empty)")}
                    </p>
                  </button>
                </div>

                {/* Base Value reference */}
                <div className="text-[10px] text-muted-foreground font-mono pt-1">
                  Base snapshot: {String(conflict.baseValue ?? "(none)")}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-4 pt-2">
          <button
            type="button"
            onClick={handleConfirmResolution}
            className="neu-border neu-press flex items-center justify-center gap-2 w-full bg-black px-4 py-2.5 font-mono text-xs font-bold uppercase text-cream"
          >
            <RefreshCw className="h-4 w-4" />
            Apply Conflict Resolution & Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
