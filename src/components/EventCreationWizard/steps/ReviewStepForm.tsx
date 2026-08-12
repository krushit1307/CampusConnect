// src/components/EventCreationWizard/steps/ReviewStepForm.tsx
import { useEventWizardStore } from "../../../store/useEventWizardStore";
import { WIZARD_STEPS } from "../../../lib/eventWizardSchema";

/**
 * Step 5 (final): Review & Submit.
 * Shows a read-only summary of all collected form data.
 * The user can click any section's "Edit" button to jump back to
 * that step.
 */
export function ReviewStepForm() {
  const formData = useEventWizardStore((s) => s.formData);
  const goToStep = useEventWizardStore((s) => s.goToStep);

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Please review your event details before submitting. Use the "Edit" buttons to make changes.
      </p>

      {/* Basics */}
      <section className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Basic Info</h3>
          <button
            type="button"
            onClick={() => goToStep(0)}
            className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Edit
          </button>
        </div>
        <dl className="space-y-1 text-sm">
          <div>
            <dt className="inline font-medium">Title: </dt>
            <dd className="inline">{formData.title || "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Category: </dt>
            <dd className="inline">{formData.category || "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Tags: </dt>
            <dd className="inline">{formData.tags.length ? formData.tags.join(", ") : "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Description: </dt>
            <dd className="inline">
              {formData.description.slice(0, 100)}
              {formData.description.length > 100 ? "…" : ""}
            </dd>
          </div>
        </dl>
      </section>

      {/* Date & Location */}
      <section className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Date &amp; Location</h3>
          <button
            type="button"
            onClick={() => goToStep(1)}
            className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Edit
          </button>
        </div>
        <dl className="space-y-1 text-sm">
          <div>
            <dt className="inline font-medium">Start: </dt>
            <dd className="inline">{formatDate(formData.startDate)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">End: </dt>
            <dd className="inline">{formatDate(formData.endDate)}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Location: </dt>
            <dd className="inline">{formData.location || "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Virtual: </dt>
            <dd className="inline">{formData.isVirtual ? "Yes" : "No"}</dd>
          </div>
          {formData.isVirtual && (
            <div>
              <dt className="inline font-medium">Meeting URL: </dt>
              <dd className="inline">{formData.meetingUrl || "—"}</dd>
            </div>
          )}
          <div>
            <dt className="inline font-medium">Capacity: </dt>
            <dd className="inline">{formData.capacity}</dd>
          </div>
        </dl>
      </section>

      {/* Ticketing */}
      <section className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Ticketing</h3>
          <button
            type="button"
            onClick={() => goToStep(2)}
            className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Edit
          </button>
        </div>
        <dl className="space-y-1 text-sm">
          <div>
            <dt className="inline font-medium">Type: </dt>
            <dd className="inline">{formData.isPaid ? "Paid" : "Free"}</dd>
          </div>
          {formData.isPaid && (
            <div>
              <dt className="inline font-medium">Tiers ({formData.tickets.length}): </dt>
              <dd className="inline">
                {formData.tickets.map((t, i) => (
                  <span key={i}>
                    {t.name} (${t.price}, cap {t.capacity})
                    {i < formData.tickets.length - 1 ? ", " : ""}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Customizations */}
      <section className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Customizations</h3>
          <button
            type="button"
            onClick={() => goToStep(3)}
            className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Edit
          </button>
        </div>
        <dl className="space-y-1 text-sm">
          <div>
            <dt className="inline font-medium">Cover Image: </dt>
            <dd className="inline">{formData.coverImageUrl ? "Yes" : "None"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Banner Color: </dt>
            <dd className="inline">
              <span
                className="inline-block h-3 w-3 rounded-full align-middle"
                style={{ backgroundColor: formData.bannerColor }}
                aria-hidden="true"
              />{" "}
              {formData.bannerColor}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Featured: </dt>
            <dd className="inline">{formData.isFeatured ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Waitlist: </dt>
            <dd className="inline">{formData.allowWaitlist ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Reminder Emails: </dt>
            <dd className="inline">{formData.sendReminderEmails ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
