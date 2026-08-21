import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import React, { useState } from "react";
import { toast } from "sonner";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "post" | "comment" | "club" | "event";
  targetId: string;
}

export const ReportDialog: React.FC<ReportDialogProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
}) => {
  const [reason, setReason] = useState("Spam");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please sign in to submit a report.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("content_reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: String(targetId),
        reason,
        details: details.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("You have already reported this content.");
          onClose();
          return;
        }
        throw error;
      }

      toast.success("Thank you. The content has been flagged for moderation.");
      setDetails("");
      setReason("Spam");
      onClose();
    } catch (err: unknown) {
      console.error("Failed to submit report:", err);

      const error = err as { code?: string };

      if (error.code === "P0001") {
        toast.error("You have submitted too many reports recently. Please try again later.");
      } else {
        toast.error("Failed to submit report. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report Content">
      <p className="text-xs text-gray-500 font-mono">
        Help us keep CampusConnect safe by reporting inappropriate content.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-black">
        <div>
          <label className="font-mono text-xs font-bold uppercase block mb-1">
            Reason for report
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="neu-border w-full p-2 font-mono text-sm bg-white"
          >
            <option value="Spam">Spam</option>
            <option value="Harassment">Harassment</option>
            <option value="Inappropriate">Inappropriate / Explicit</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="font-mono text-xs font-bold uppercase block mb-1">
            Additional Details (Optional)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Please provide any additional context..."
            className="neu-border w-full p-2 font-mono text-sm min-h-[80px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="neu-border bg-white text-black px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="neu-border bg-black text-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-cream hover:text-black disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
