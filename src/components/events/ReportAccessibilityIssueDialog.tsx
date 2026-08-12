/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useMutation } from "@/hooks/useReactQueryReplacement";
import type { User } from "@supabase/supabase-js";
import Flag from "lucide-react/dist/esm/icons/flag";

interface ReportAccessibilityIssueDialogProps {
  eventId: string;
  venueId?: string;
  user: User | null;
}

export function ReportAccessibilityIssueDialog({
  eventId,
  venueId,
  user,
}: ReportAccessibilityIssueDialogProps) {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState("");
  const [description, setDescription] = useState("");
  const supabase = createClient();

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be logged in to report an issue.");
      if (!feature) throw new Error("Please select a feature.");
      if (!description.trim()) throw new Error("Please provide a description.");

      const { error } = await supabase.from("accessibility_reports").insert({
        event_id: eventId,
        venue_id: venueId || null,
        feature,
        description: description.trim(),
        reporter_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Accessibility issue reported successfully.");
      setOpen(false);
      setFeature("");
      setDescription("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit report.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reportMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <Flag className="h-4 w-4" />
          Report Accessibility Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report Accessibility Issue</DialogTitle>
          <DialogDescription>
            Notice an issue with the accessibility features at this venue? Let us know so we can
            inform the organizers.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="feature">Affected Feature</Label>
            <Select value={feature} onValueChange={setFeature}>
              <SelectTrigger id="feature">
                <SelectValue placeholder="Select a feature" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="has_elevator">Elevator</SelectItem>
                <SelectItem value="wheelchair_ramp">Wheelchair Ramp</SelectItem>
                <SelectItem value="gender_neutral_restrooms">Gender-Neutral Restrooms</SelectItem>
                <SelectItem value="hearing_loop">Hearing Loop</SelectItem>
                <SelectItem value="low_sensory_zone">Low-Sensory Zone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="e.g., The elevator is currently out of service."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={reportMutation.isPending || !feature || !description.trim()}
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
