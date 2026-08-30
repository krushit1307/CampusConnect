import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Volume2 from "lucide-react/dist/esm/icons/volume-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import X from "lucide-react/dist/esm/icons/x";

export function NoiseComplaintWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmitComplaint = () => {
    setError(null);
    setSuccessMsg(null);
    setIsLocating(true);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsLocating(false);
        setIsSubmitting(true);
        try {
          const supabase = createClient();
          const { data, error } = await supabase.functions.invoke("report-noise-complaint", {
            body: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          });

          if (error) throw error;
          if (data && !data.success) {
            setError(data.error || "No active events found nearby.");
          } else {
            setSuccessMsg(
              `Complaint successfully routed! Event: "${data.event_title}". (Total active complaints: ${data.complaint_count})`,
            );
          }
        } catch (err: any) {
          setError(err.message || "Failed to submit noise complaint.");
        } finally {
          setIsSubmitting(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setError("Failed to retrieve your location. Please check your GPS permissions.");
      },
    );
  };

  return (
    <>
      {/* Floating megaphone button */}
      <button
        onClick={() => {
          setError(null);
          setSuccessMsg(null);
          setIsOpen(true);
        }}
        data-testid="noise-complaint-btn"
        className="fixed bottom-6 right-24 z-50 flex items-center gap-2 border-2 border-black bg-yellow-300 px-4 py-2 font-mono text-xs font-bold uppercase shadow-[4px_4px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000] transition-all"
      >
        <Volume2 size={16} />
        Report Noise
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div
            data-testid="noise-complaint-modal"
            className="w-full max-w-md border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000]"
          >
            <div className="flex items-center justify-between border-b-4 border-black pb-3">
              <h3 className="flex items-center gap-2 font-mono text-sm font-black uppercase tracking-wide">
                <AlertTriangle size={18} className="text-yellow-500" />
                Report Noise / Disturbance
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="border-2 border-black p-1 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-4 font-mono text-xs leading-relaxed text-gray-700">
              Is a grandfathered event playing loud music during finals week? Place a report below.
              We will check your GPS location against active events within 500 feet and notify the
              organizers immediately.
            </p>

            {error && (
              <div className="mt-4 border-2 border-black bg-red-100 p-3 font-mono text-xs font-bold text-red-700">
                ⚠️ {error}
              </div>
            )}

            {successMsg && (
              <div className="mt-4 border-2 border-black bg-green-100 p-3 font-mono text-xs font-bold text-green-700">
                🎉 {successMsg}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 font-mono text-xs font-bold">
              <button
                onClick={() => setIsOpen(false)}
                className="border-2 border-black bg-white px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitComplaint}
                disabled={isLocating || isSubmitting}
                data-testid="submit-noise-complaint-btn"
                className="border-2 border-black bg-yellow-300 px-4 py-2 hover:bg-yellow-400 disabled:opacity-50"
              >
                {isLocating
                  ? "Locating GPS..."
                  : isSubmitting
                    ? "Submitting Report..."
                    : "Submit Noise Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
