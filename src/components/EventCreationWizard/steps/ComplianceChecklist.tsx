// src/components/EventCreationWizard/steps/ComplianceChecklist.tsx
import { useEventWizardStore } from "../../../store/useEventWizardStore";
import { getRequiredPermits, RequiredPermit } from "../../../utils/eventComplianceChecker";

const PERMIT_LABELS: Record<RequiredPermit, string> = {
  FOOD_SAFETY_PERMIT: "Food Safety Permit (required for food-related events)",
  SECURITY_PERMIT: "Security Permit (required for events over 100 attendees)",
};

/**
 * Shown on the Review step when an event trips one of the compliance
 * heuristics (see src/utils/eventComplianceChecker.ts). The organizer
 * must provide a link to the uploaded permit PDF before the Submit
 * button is enabled. Once submitted, the backend places the event in
 * PENDING_REVIEW until a Student Union Admin approves it.
 */
export function ComplianceChecklist() {
  const formData = useEventWizardStore((s) => s.formData);
  const updateFormData = useEventWizardStore((s) => s.updateFormData);

  const requiredPermits = getRequiredPermits({
    capacity: formData.capacity,
    category: formData.category,
    tags: formData.tags,
  });

  if (requiredPermits.length === 0) {
    return null;
  }

  return (
    <section
      role="alert"
      className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950"
    >
      <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
        Compliance Checklist
      </h3>
      <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
        This event needs the following permit(s) uploaded before it can be published. After
        submission it will be placed in "Pending Review" until an admin approves it.
      </p>
      <ul className="mt-2 list-inside list-disc text-sm text-amber-700 dark:text-amber-300">
        {requiredPermits.map((permit) => (
          <li key={permit}>{PERMIT_LABELS[permit]}</li>
        ))}
      </ul>
      <label className="mt-3 block text-sm font-medium text-amber-800 dark:text-amber-200">
        Permit document URL (PDF)
        <input
          type="url"
          value={formData.compliancePermitUrl}
          onChange={(e) => updateFormData({ compliancePermitUrl: e.target.value })}
          placeholder="https://example.com/permit.pdf"
          className="mt-1 block w-full rounded-md border border-amber-300 p-2 text-sm dark:border-amber-700 dark:bg-slate-900"
        />
      </label>
    </section>
  );
}