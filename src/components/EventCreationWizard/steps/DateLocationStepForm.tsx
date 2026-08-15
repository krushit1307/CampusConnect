// src/components/EventCreationWizard/steps/DateLocationStepForm.tsx
import { useEventWizardStore } from "../../../store/useEventWizardStore";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Checkbox } from "../../ui/checkbox";

/**
 * Step 2: Date & Location.
 * Collects start/end date-times, physical/virtual location, and capacity.
 */
export function DateLocationStepForm() {
  const formData = useEventWizardStore((s) => s.formData);
  const updateFormData = useEventWizardStore((s) => s.updateFormData);
  const validationErrors = useEventWizardStore((s) => s.validationErrors);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date & Time *</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={formData.startDate}
            onChange={(e) => updateFormData({ startDate: e.target.value })}
            aria-invalid={!!validationErrors.startDate}
          />
          {validationErrors.startDate && (
            <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.startDate}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">End Date & Time *</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={formData.endDate}
            onChange={(e) => updateFormData({ endDate: e.target.value })}
            aria-invalid={!!validationErrors.endDate}
          />
          {validationErrors.endDate && (
            <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.endDate}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location *</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => updateFormData({ location: e.target.value })}
          placeholder="e.g. Student Union, Room 101"
          aria-invalid={!!validationErrors.location}
        />
        {validationErrors.location && (
          <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.location}</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isVirtual"
          checked={formData.isVirtual}
          onCheckedChange={(checked) => updateFormData({ isVirtual: checked === true })}
        />
        <Label htmlFor="isVirtual" className="cursor-pointer">
          This is a virtual event (requires a meeting URL)
        </Label>
      </div>

      {formData.isVirtual && (
        <div className="space-y-2">
          <Label htmlFor="meetingUrl">Meeting URL *</Label>
          <Input
            id="meetingUrl"
            type="url"
            value={formData.meetingUrl ?? ""}
            onChange={(e) => updateFormData({ meetingUrl: e.target.value })}
            placeholder="https://zoom.us/j/..."
            aria-invalid={!!validationErrors.meetingUrl}
          />
          {validationErrors.meetingUrl && (
            <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.meetingUrl}</p>
          )}
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isOutdoor"
          checked={formData.isOutdoor}
          onCheckedChange={(checked) => updateFormData({ isOutdoor: checked === true })}
        />
        <Label htmlFor="isOutdoor" className="cursor-pointer">
          Outdoor Event
        </Label>
      </div>

      {formData.isOutdoor && (
        <div className="space-y-2">
          <Label htmlFor="backupIndoorVenue">Backup Indoor Venue</Label>
          <Input
            id="backupIndoorVenue"
            value={formData.backupIndoorVenue ?? ""}
            onChange={(e) => updateFormData({ backupIndoorVenue: e.target.value })}
            placeholder="e.g. Student Union Hall"
            aria-invalid={!!validationErrors.backupIndoorVenue}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If severe weather is forecasted, you will be prompted to automatically pivot the event
            here.
          </p>
          {validationErrors.backupIndoorVenue && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {validationErrors.backupIndoorVenue}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="capacity">Capacity *</Label>
        <Input
          id="capacity"
          type="number"
          min={1}
          max={100000}
          value={formData.capacity}
          onChange={(e) => updateFormData({ capacity: parseInt(e.target.value, 10) || 0 })}
          aria-invalid={!!validationErrors.capacity}
        />
        {validationErrors.capacity && (
          <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.capacity}</p>
        )}
      </div>
    </div>
  );
}
