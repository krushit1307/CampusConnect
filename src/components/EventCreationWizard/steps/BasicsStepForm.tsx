// src/components/EventCreationWizard/steps/BasicsStepForm.tsx
import { useEventWizardStore } from "../../../store/useEventWizardStore";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";

const CATEGORIES = [
  "Academic",
  "Sports",
  "Cultural",
  "Technology",
  "Social",
  "Workshop",
  "Career",
  "Other",
];

/**
 * Step 1: Basic Info.
 * Collects title, description, category, and tags.
 */
export function BasicsStepForm() {
  const formData = useEventWizardStore((s) => s.formData);
  const updateFormData = useEventWizardStore((s) => s.updateFormData);
  const validationErrors = useEventWizardStore((s) => s.validationErrors);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Event Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => updateFormData({ title: e.target.value })}
          placeholder="e.g. Annual Tech Symposium 2026"
          aria-invalid={!!validationErrors.title}
          aria-describedby={validationErrors.title ? "title-error" : undefined}
        />
        {validationErrors.title && (
          <p id="title-error" className="text-sm text-red-600 dark:text-red-400">
            {validationErrors.title}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => updateFormData({ description: e.target.value })}
          placeholder="Provide a detailed description of your event (at least 20 characters)..."
          rows={5}
          aria-invalid={!!validationErrors.description}
          aria-describedby={validationErrors.description ? "description-error" : undefined}
        />
        {validationErrors.description && (
          <p id="description-error" className="text-sm text-red-600 dark:text-red-400">
            {validationErrors.description}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category *</Label>
        <select
          id="category"
          value={formData.category}
          onChange={(e) => updateFormData({ category: e.target.value })}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          aria-invalid={!!validationErrors.category}
        >
          <option value="">Select a category…</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {validationErrors.category && (
          <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.category}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (comma-separated, max 10)</Label>
        <Input
          id="tags"
          value={formData.tags.join(", ")}
          onChange={(e) =>
            updateFormData({
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 10),
            })
          }
          placeholder="e.g. hackathon, ai, beginners"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">{formData.tags.length}/10 tags</p>
      </div>
    </div>
  );
}
