// src/components/EventCreationWizard/steps/CustomizationsStepForm.tsx
import { useEventWizardStore } from "../../../store/useEventWizardStore";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Checkbox } from "../../ui/checkbox";

/**
 * Step 4: Customizations.
 * Cover image, banner color, and optional event settings.
 */
export function CustomizationsStepForm() {
  const formData = useEventWizardStore((s) => s.formData);
  const updateFormData = useEventWizardStore((s) => s.updateFormData);
  const validationErrors = useEventWizardStore((s) => s.validationErrors);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="coverImageUrl">Cover Image URL (optional)</Label>
        <Input
          id="coverImageUrl"
          type="url"
          value={formData.coverImageUrl ?? ""}
          onChange={(e) => updateFormData({ coverImageUrl: e.target.value })}
          placeholder="https://example.com/cover.jpg"
          aria-invalid={!!validationErrors.coverImageUrl}
        />
        {validationErrors.coverImageUrl && (
          <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.coverImageUrl}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bannerColor">Banner Color</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            id="bannerColor"
            value={formData.bannerColor}
            onChange={(e) => updateFormData({ bannerColor: e.target.value })}
            className="h-10 w-16 cursor-pointer rounded-md border border-slate-300 dark:border-slate-700"
            aria-label="Banner color picker"
          />
          <Input
            value={formData.bannerColor}
            onChange={(e) => updateFormData({ bannerColor: e.target.value })}
            className="flex-1 font-mono"
            aria-label="Banner color hex value"
          />
        </div>
        {validationErrors.bannerColor && (
          <p className="text-sm text-red-600 dark:text-red-400">{validationErrors.bannerColor}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isFeatured"
            checked={formData.isFeatured}
            onCheckedChange={(checked) => updateFormData({ isFeatured: checked === true })}
          />
          <Label htmlFor="isFeatured" className="cursor-pointer">
            Feature this event on the home page
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="allowWaitlist"
            checked={formData.allowWaitlist}
            onCheckedChange={(checked) => updateFormData({ allowWaitlist: checked === true })}
          />
          <Label htmlFor="allowWaitlist" className="cursor-pointer">
            Allow waitlist when at capacity
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="sendReminderEmails"
            checked={formData.sendReminderEmails}
            onCheckedChange={(checked) => updateFormData({ sendReminderEmails: checked === true })}
          />
          <Label htmlFor="sendReminderEmails" className="cursor-pointer">
            Send reminder emails to attendees before the event
          </Label>
        </div>

        {/* NEW: Live Album Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isLiveAlbumActive"
            checked={!!formData.isLiveAlbumActive}
            onCheckedChange={(checked) => updateFormData({ isLiveAlbumActive: checked === true })}
          />
          <Label htmlFor="isLiveAlbumActive" className="cursor-pointer font-medium text-blue-600 dark:text-blue-400">
            Enable Live Event Album (Attendees can upload photos to a projector view)
          </Label>
        </div>
      </div>
    </div>
  );
}
