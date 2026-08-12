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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useMutation, useQuery } from "@/hooks/useReactQueryReplacement";
import type { User } from "@supabase/supabase-js";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { format } from "date-fns";

interface ManageAccessibilityOverridesDialogProps {
  venueId: string;
  user: User | null;
}

export function ManageAccessibilityOverridesDialog({
  venueId,
  user,
}: ManageAccessibilityOverridesDialogProps) {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState("");
  const [status, setStatus] = useState("unavailable");
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const supabase = createClient();

  const { data: overrides, refetch } = useQuery({
    queryKey: ["venue_overrides", venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venue_accessibility_overrides")
        .select("*")
        .eq("venue_id", venueId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!venueId,
  });

  const createOverride = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Unauthorized");
      if (!feature || !message || !expiresAt) throw new Error("Please fill in all fields");

      const { error } = await supabase.from("venue_accessibility_overrides").insert({
        venue_id: venueId,
        feature,
        status,
        message: message.trim(),
        expires_at: new Date(expiresAt).toISOString(),
        created_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Override created.");
      setFeature("");
      setMessage("");
      setExpiresAt("");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteOverride = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("venue_accessibility_overrides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Override removed.");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOverride.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <AlertCircle className="h-4 w-4" />
          Manage Overrides
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Accessibility Overrides</DialogTitle>
          <DialogDescription>
            Add temporary alerts (e.g., broken elevator) for this venue.
          </DialogDescription>
        </DialogHeader>

        {overrides && overrides.length > 0 && (
          <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">
            <h4 className="text-sm font-semibold">Active Overrides</h4>
            {overrides.map((ov: any) => (
              <div
                key={ov.id}
                className="flex items-center justify-between p-2 border rounded-md text-sm bg-muted/50"
              >
                <div>
                  <span className="font-semibold capitalize">
                    {ov.feature.replace(/_/g, " ")}:{" "}
                  </span>
                  <span
                    className={
                      ov.status === "unavailable"
                        ? "text-red-600 font-bold"
                        : "text-green-600 font-bold"
                    }
                  >
                    {ov.status}
                  </span>
                  <p className="text-muted-foreground text-xs">{ov.message}</p>
                  <p className="text-muted-foreground text-xs">
                    Expires: {format(new Date(ov.expires_at), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteOverride.mutate(ov.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t">
          <h4 className="text-sm font-semibold">New Override</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="feature">Feature</Label>
              <Select value={feature} onValueChange={setFeature}>
                <SelectTrigger id="feature">
                  <SelectValue placeholder="Select" />
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
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Input
              id="message"
              placeholder="e.g., Out of service until tomorrow"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiresAt">Expires At</Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={createOverride.isPending || !feature || !message || !expiresAt}
            >
              {createOverride.isPending ? "Adding..." : "Add Override"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
