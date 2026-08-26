import React from "react";
import { useEventWizard } from "../../hooks/useEventWizard";

export function BasicsStep({ wizard }: { wizard: ReturnType<typeof useEventWizard> }) {
  const { context, updateForm } = wizard;
  const { title, description, category, isPaid, startDate, endDate } = context.formData;
  const { validationErrors } = context;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Event Title *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => updateForm({ title: e.target.value })}
          className={`w-full p-2 rounded-md border ${validationErrors.title ? "border-red-500" : "border-input"} bg-background`}
        />
        {validationErrors.title && (
          <p className="text-red-500 text-xs mt-1" aria-live="polite">
            {validationErrors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description *
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => updateForm({ description: e.target.value })}
          className={`w-full p-2 rounded-md border ${validationErrors.description ? "border-red-500" : "border-input"} bg-background min-h-[100px]`}
        />
        {validationErrors.description && (
          <p className="text-red-500 text-xs mt-1" aria-live="polite">
            {validationErrors.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium mb-1">
            Start Date *
          </label>
          <input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => updateForm({ startDate: e.target.value })}
            className={`w-full p-2 rounded-md border ${validationErrors.startDate ? "border-red-500" : "border-input"} bg-background`}
          />
          {validationErrors.startDate && (
            <p className="text-red-500 text-xs mt-1" aria-live="polite">
              {validationErrors.startDate}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium mb-1">
            End Date *
          </label>
          <input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => updateForm({ endDate: e.target.value })}
            className={`w-full p-2 rounded-md border ${validationErrors.endDate ? "border-red-500" : "border-input"} bg-background`}
          />
          {validationErrors.endDate && (
            <p className="text-red-500 text-xs mt-1" aria-live="polite">
              {validationErrors.endDate}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-1">
            Category *
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => updateForm({ category: e.target.value })}
            className={`w-full p-2 rounded-md border ${validationErrors.category ? "border-red-500" : "border-input"} bg-background`}
          >
            <option value="">Select a category</option>
            <option value="tech">Tech</option>
            <option value="music">Music</option>
            <option value="sports">Sports</option>
          </select>
          {validationErrors.category && (
            <p className="text-red-500 text-xs mt-1" aria-live="polite">
              {validationErrors.category}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4">
        <input
          id="isPaid"
          type="checkbox"
          checked={isPaid}
          onChange={(e) => updateForm({ isPaid: e.target.checked })}
          className="w-4 h-4 rounded border-input"
        />
        <label htmlFor="isPaid" className="text-sm font-medium">
          This is a paid event
        </label>
      </div>
    </div>
  );
}
