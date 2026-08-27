import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Check, X, Clock, User } from "lucide-react";
import format from "date-fns/format";

interface PendingEntry {
  id: string;
  hours_credited: number;
  notes: string;
  created_at: string;
  user_id: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
  clubs: {
    name: string;
  };
}

interface VolunteerApprovalPanelProps {
  onApproved: () => void;
}

export function VolunteerApprovalPanel({ onApproved }: VolunteerApprovalPanelProps) {
  const supabase = createClient();
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingEntries();
  }, []);

  const fetchPendingEntries = async () => {
    setIsLoading(true);

    // The RLS policy "Club admins can manage their club ledger" limits what we can select/update.
    // We only want pending status.
    const { data, error } = await supabase
      .from("volunteer_ledger")
      .select(
        `
        id, hours_credited, notes, created_at, user_id,
        profiles(first_name, last_name),
        clubs(name)
      `,
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setPendingEntries(data as any[]);
    }
    setIsLoading(false);
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    const { error } = await supabase
      .from("volunteer_ledger")
      .update({
        status: "approved",
        approved_by: (await supabase.auth.getUser()).data.user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);

    setActionLoading(null);

    if (error) {
      toast.error("Failed to approve hours: " + error.message);
    } else {
      toast.success("Hours approved");
      setPendingEntries((prev) => prev.filter((e) => e.id !== id));
      onApproved();
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    const { error } = await supabase
      .from("volunteer_ledger")
      .update({
        status: "rejected",
        approved_by: (await supabase.auth.getUser()).data.user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);

    setActionLoading(null);

    if (error) {
      toast.error("Failed to reject hours: " + error.message);
    } else {
      toast.success("Hours rejected");
      setPendingEntries((prev) => prev.filter((e) => e.id !== id));
    }
  };

  return (
    <Card className="border-amber-200 dark:border-amber-900 shadow-sm">
      <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" /> Action Required
        </CardTitle>
        <CardDescription>Members waiting for hour verification</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : pendingEntries.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No pending hours to review. You're all caught up!
          </div>
        ) : (
          <div className="space-y-4">
            {pendingEntries.map((entry) => (
              <div
                key={entry.id}
                className="p-3 border rounded-md bg-card shadow-sm flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-medium text-sm flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      {entry.profiles?.first_name} {entry.profiles?.last_name}
                    </h5>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.clubs?.name}</p>
                  </div>
                  <div className="font-bold text-lg text-right leading-none">
                    {Number(entry.hours_credited).toFixed(1)}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground block uppercase">
                      Hours
                    </span>
                  </div>
                </div>

                <p className="text-sm bg-muted/50 p-2 rounded italic text-muted-foreground">
                  "{entry.notes || "No description provided."}"
                  <span className="block text-[10px] mt-1 not-italic">
                    Logged {format(new Date(entry.created_at), "MMM d, yyyy")}
                  </span>
                </p>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    disabled={actionLoading === entry.id}
                    onClick={() => handleReject(entry.id)}
                  >
                    <X className="w-4 h-4 mr-1" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    disabled={actionLoading === entry.id}
                    onClick={() => handleApprove(entry.id)}
                  >
                    {actionLoading === entry.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-1" />
                    )}
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
