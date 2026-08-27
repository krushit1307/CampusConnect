import React, { useState, useEffect } from "react";
import DataGrid, { Column } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import {
  BudgetItem,
  BudgetSnapshot,
  saveBudgetSnapshot,
  fetchBudgetHistory,
} from "@/services/eventBudgetService";

interface BudgetBuilderProps {
  eventId: string;
  userId: string;
}

export const BudgetBuilder: React.FC<BudgetBuilderProps> = ({ eventId, userId }) => {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [history, setHistory] = useState<BudgetSnapshot[]>([]);
  const [lastTimestamp, setLastTimestamp] = useState<string | undefined>();
  const [compareVersion, setCompareVersion] = useState<BudgetSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [eventId]);

  const loadHistory = async () => {
    try {
      const data = await fetchBudgetHistory(eventId);
      setHistory(data);
      if (data.length > 0) {
        setItems(data[0].payload_json);
        setLastTimestamp(data[0].created_at);
      }
    } catch (err: any) {
      setError("Failed to load budget history");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const newSnapshot = await saveBudgetSnapshot(eventId, userId, items, lastTimestamp);
      setLastTimestamp(newSnapshot.created_at);
      await loadHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const columns: Column<BudgetItem>[] = [
    { key: "category", name: "Category", editable: true },
    { key: "description", name: "Description", editable: true },
    {
      key: "amount",
      name: "Amount ($)",
      editable: true,
      renderCell: ({ row }) => `$${row.amount.toLocaleString()}`,
    },
  ];

  // Diff Logic: Compare current items with selected past version
  const getDiff = () => {
    if (!compareVersion) return [];
    const pastItemsMap = new Map(compareVersion.payload_json.map((i) => [i.id, i]));
    
    return items.map((current) => {
      const past = pastItemsMap.get(current.id);
      const diffAmount = past ? current.amount - past.amount : current.amount;
      return {
        ...current,
        diffAmount,
        type: !past ? "added" : diffAmount !== 0 ? "modified" : "unchanged",
      };
    });
  };

  return (
    <div className="grid grid-cols-4 gap-6 p-6 bg-white rounded-xl shadow-sm">
      <div className="col-span-3 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Event Budget Builder</h2>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Snapshot"}
          </button>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <div className="border rounded-lg overflow-hidden">
          <DataGrid
            columns={columns}
            rows={items}
            onRowsChange={setItems}
            className="rdg-light h-80"
          />
        </div>

        {compareVersion && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-md font-semibold text-gray-800 mb-2">
              Diff View (Comparing with v{compareVersion.version_hash})
            </h3>
            <div className="space-y-1 text-sm font-mono">
              {getDiff().map((diff) => (
                <div
                  key={diff.id}
                  className={`p-2 rounded flex justify-between ${
                    diff.type === "added"
                      ? "bg-green-50 text-green-800"
                      : diff.type === "modified"
                      ? diff.diffAmount > 0
                        ? "bg-green-50 text-green-800"
                        : "bg-red-50 text-red-800"
                      : "text-gray-600"
                  }`}
                >
                  <span>{diff.description} ({diff.category})</span>
                  <span>
                    {diff.diffAmount > 0 ? `+$${diff.diffAmount}` : `-$${Math.abs(diff.diffAmount)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="col-span-1 border-l pl-4 space-y-3">
        <h3 className="font-bold text-gray-900 mb-2">Version History</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {history.map((snap) => (
            <div
              key={snap.id}
              className={`p-3 border rounded-lg text-xs space-y-1 cursor-pointer hover:border-indigo-500 ${
                compareVersion?.id === snap.id ? "border-indigo-600 bg-indigo-50" : ""
              }`}
              onClick={() => setCompareVersion(snap)}
            >
              <div className="flex justify-between font-bold text-gray-700">
                <span>v{snap.version_hash}</span>
                <span>{new Date(snap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="text-gray-500">
                Total: ${snap.payload_json.reduce((sum, item) => sum + Number(item.amount), 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
