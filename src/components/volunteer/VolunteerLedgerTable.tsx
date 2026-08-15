import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Calendar, Clock, Building } from "lucide-react";
import format from "date-fns/format";
import { Badge } from "@/components/ui/badge";

interface LedgerEntry {
  id: string;
  club_id: string;
  hours_credited: number;
  status: string;
  notes: string;
  created_at: string;
  club: {
    name: string;
  };
}

interface VolunteerLedgerTableProps {
  userId: string;
  onRecordUpdated: () => void;
}

export function VolunteerLedgerTable({ userId, onRecordUpdated }: VolunteerLedgerTableProps) {
  const supabase = createClient();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLedger();
    fetchUserClubs();
  }, []);

  const fetchLedger = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("volunteer_ledger")
      .select(
        `
        id, club_id, hours_credited, status, notes, created_at,
        club:clubs(name)
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load activity");
    } else {
      setEntries(data as any[]);
    }
    setIsLoading(false);
  };

  const fetchUserClubs = async () => {
    // Get clubs the user is a member of to allow manual logging
    const { data } = await supabase
      .from("club_members")
      .select("club_id, clubs(id, name)")
      .eq("user_id", userId);

    if (data) {
      const formattedClubs = data
        .filter((d: any) => d.clubs)
        .map((d: any) => ({ id: d.clubs.id, name: d.clubs.name }));

      // Deduplicate
      const uniqueClubs = Array.from(
        new Map(formattedClubs.map((item) => [item.id, item])).values(),
      );
      setClubs(uniqueClubs);
    }
  };

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClub || !hours) return;

    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      toast.error("Please enter a valid number of hours");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from("volunteer_ledger").insert({
      user_id: userId,
      club_id: selectedClub,
      hours_credited: parsedHours,
      status: "pending",
      notes: notes || "Manual retro-active entry",
    });

    setIsSubmitting(false);

    if (error) {
      toast.error("Failed to log hours: " + error.message);
    } else {
      toast.success("Hours submitted for approval");
      setIsModalOpen(false);
      setHours("");
      setNotes("");
      setSelectedClub("");
      fetchLedger();
      onRecordUpdated();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>Your recent community service contributions</CardDescription>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Log Hours
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Volunteer Hours</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitEntry} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Club / Organization</Label>
                <Select value={selectedClub} onValueChange={setSelectedClub} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a club" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    {clubs.length === 0 && (
                      <SelectItem value="none" disabled>
                        No club memberships found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hours Completed</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  placeholder="e.g. 1.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Notes / Description</Label>
                <Input
                  placeholder="What did you help with?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit for Approval
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            No volunteer hours recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-full hidden sm:block">
                    <Building className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      {entry.club?.name || "Unknown Club"}
                      {entry.status === "approved" ? (
                        <Badge
                          variant="default"
                          className="bg-green-500/10 text-green-600 hover:bg-green-500/20"
                        >
                          Approved
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-amber-600 bg-amber-500/10 hover:bg-amber-500/20"
                        >
                          Pending
                        </Badge>
                      )}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{" "}
                        {format(new Date(entry.created_at), "MMM d, yyyy")}
                      </span>
                      <span className="flex items-center gap-1 line-clamp-1">
                        <Clock className="w-3 h-3" /> {entry.notes}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-4 sm:mt-0 text-left sm:text-right">
                  <div className="text-2xl font-bold">
                    {Number(entry.hours_credited).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Hours
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
