import React, { useState } from "react";
import { EventTask } from "@/types/eventTasks";
import X from "lucide-react/dist/esm/icons/x";

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: {
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
    progress: number;
    dependencies: string[];
  }) => void;
  existingTasks: EventTask[];
}

export function AddTaskModal({ isOpen, onClose, onAdd, existingTasks }: AddTaskModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
  );
  const [progress, setProgress] = useState(0);
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name,
      description,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      progress,
      dependencies: selectedDependencies,
    });

    setName("");
    setDescription("");
    setProgress(0);
    setSelectedDependencies([]);
    onClose();
  };

  const toggleDependency = (id: string) => {
    setSelectedDependencies((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 p-6 neu-border space-y-4">
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-800 pb-3">
          <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
            Add Event Task
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-black">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-sm">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
              Task Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Book Venue"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or details..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
              Progress ({progress}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full cursor-pointer accent-black"
            />
          </div>

          {existingTasks.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 dark:text-slate-400 mb-1">
                Prerequisite Tasks (Dependencies)
              </label>
              <div className="max-h-28 overflow-y-auto space-y-1.5 border border-gray-200 dark:border-slate-800 p-2">
                {existingTasks.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedDependencies.includes(t.id)}
                      onChange={() => toggleDependency(t.id)}
                      className="accent-black"
                    />
                    <span className="truncate">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-gray-300 font-mono text-xs font-bold uppercase hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-black text-white font-mono text-xs font-bold uppercase hover:bg-gray-800"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
