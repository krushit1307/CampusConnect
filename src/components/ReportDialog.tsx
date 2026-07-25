import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
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

      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
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
    } catch (err) {
      console.error("Failed to submit report:", err);
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report Content"
      description="Help us keep CampusConnect safe by reporting inappropriate content."
      className="neu-border max-w-md rounded-none bg-white p-6"
    >
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
