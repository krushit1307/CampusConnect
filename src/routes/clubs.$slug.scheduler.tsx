import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, CalendarClock, Users, Clock, CheckCircle2 } from "lucide-react";
import { AvailabilityGrid } from "@/components/Scheduler/AvailabilityGrid";
import { availabilityService, AvailabilitySlot } from "@/services/availabilityService";
import { findBestMeetingTimes, MeetingSuggestion } from "@/lib/schedulerAlgorithm";
import { isExecutiveRole } from "@/types/clubAffiliation";

export default function ClubScheduler() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [clubId, setClubId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // State for step 1
  const [targetGroup, setTargetGroup] = useState<string>("executives");
  const [duration, setDuration] = useState<number>(2); // in 30-min slots

  // State for step 2 (My Availability)
  const [myBusySlots, setMyBusySlots] = useState<Set<string>>(new Set());
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  // State for step 3 (Results)
  const [suggestions, setSuggestions] = useState<MeetingSuggestion[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    const fetchClubAndInitialData = async () => {
      if (!slug || !user) return;

      try {
        // Fetch club id
        const { data: club } = await supabase.from("clubs").select("id").eq("slug", slug).single();

        if (club) {
          setClubId(club.id);
        }

        // Fetch user's own availability
        const myAvail = await availabilityService.getUserAvailability(user.id);
        const busy = new Set<string>();
        myAvail.forEach((record) => {
          if (!record.is_available) {
            busy.add(`${record.day_of_week}-${record.slot_index}`);
          }
        });
        setMyBusySlots(busy);
      } catch (error) {
        console.error("Failed to fetch initial data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClubAndInitialData();
  }, [slug, user]);

  const handleSlotToggle = (day: number, slot: number, isBusy: boolean) => {
    const key = `${day}-${slot}`;
    setMyBusySlots((prev) => {
      const next = new Set(prev);
      if (isBusy) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const saveMyAvailability = async () => {
    if (!user) return;
    setIsSavingAvailability(true);
    try {
      // Convert all 28 slots x 7 days into an array of AvailabilitySlot
      // Default to true, if in busySlots set to false
      const slots: AvailabilitySlot[] = [];
      for (let day = 0; day < 7; day++) {
        for (let slot = 0; slot < 28; slot++) {
          const key = `${day}-${slot}`;
          const isBusy = myBusySlots.has(key);
          slots.push({ day_of_week: day, slot_index: slot, is_available: !isBusy });
        }
      }

      await availabilityService.upsertAvailability(user.id, slots);
      toast({ title: "Availability saved successfully!" });
      setStep(3);
      calculateBestTimes();
    } catch (error) {
      toast({ title: "Error saving availability", variant: "destructive" });
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const calculateBestTimes = async () => {
    if (!clubId) return;
    setIsCalculating(true);

    try {
      // 1. Fetch club members
      const { data: members } = await supabase
        .from("club_members")
        .select(
          `
          user_id,
          role_id,
          club_roles(title)
        `,
        )
        .eq("club_id", clubId)
        .eq("status", "approved");

      if (!members || members.length === 0) {
        setSuggestions([]);
        return;
      }

      // 2. Filter target users
      const targetUserIds = members
        .filter((m) => {
          if (targetGroup === "all") return true;
          if (targetGroup === "executives") {
            const title = m.club_roles?.title || m.role_id || "member";
            return isExecutiveRole(title);
          }
          return false;
        })
        .map((m) => m.user_id);

      if (targetUserIds.length === 0) {
        toast({ title: "No members found in the selected group." });
        setSuggestions([]);
        return;
      }

      // 3. Fetch availability for target users
      const allAvailability = await availabilityService.getAvailabilityForUsers(targetUserIds);

      // 4. Run algorithm
      const bestTimes = findBestMeetingTimes(allAvailability, targetUserIds, duration);
      setSuggestions(bestTimes);
    } catch (error) {
      console.error("Error calculating best times:", error);
      toast({ title: "Failed to calculate times", variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const formatSlotTime = (slotIndex: number) => {
    const hour = 8 + Math.floor(slotIndex / 2);
    const min = slotIndex % 2 === 0 ? "00" : "30";
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${min} ${ampm}`;
  };

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (loading) return <div className="p-8 text-center text-gray-500">Loading scheduler...</div>;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/clubs/${slug}/manage`}>
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Smart Scheduler</h1>
          <p className="text-gray-500">Find the optimal time for your team to meet.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <div
          className={`px-3 py-1 rounded-full ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-gray-100"}`}
        >
          1. Setup
        </div>
        <div className={`h-1 w-8 ${step >= 2 ? "bg-primary" : "bg-gray-200"}`} />
        <div
          className={`px-3 py-1 rounded-full ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-gray-100"}`}
        >
          2. My Availability
        </div>
        <div className={`h-1 w-8 ${step >= 3 ? "bg-primary" : "bg-gray-200"}`} />
        <div
          className={`px-3 py-1 rounded-full ${step >= 3 ? "bg-primary text-primary-foreground" : "bg-gray-100"}`}
        >
          3. Results
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Meeting Requirements</CardTitle>
            <CardDescription>Who needs to be at this meeting and for how long?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" /> Target Group
              </label>
              <Select value={targetGroup} onValueChange={setTargetGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executives">All Executives</SelectItem>
                  <SelectItem value="all">All Members</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" /> Duration
              </label>
              <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">30 Minutes</SelectItem>
                  <SelectItem value="2">1 Hour</SelectItem>
                  <SelectItem value="3">1.5 Hours</SelectItem>
                  <SelectItem value="4">2 Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setStep(2)} className="w-full">
              Continue to Availability
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>My Availability</CardTitle>
            <CardDescription>
              Paint the times when you are BUSY. We'll combine this with your team's availability to
              find the best overlap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border rounded-md p-4 bg-gray-50/50 dark:bg-gray-900/50">
              <AvailabilityGrid busySlots={myBusySlots} onSlotToggle={handleSlotToggle} />
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)} className="w-full">
                Back
              </Button>
              <Button
                onClick={saveMyAvailability}
                disabled={isSavingAvailability}
                className="w-full"
              >
                {isSavingAvailability ? "Saving..." : "Save & Find Times"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested Times</CardTitle>
            <CardDescription>
              Based on the availability of{" "}
              {targetGroup === "executives" ? "executives" : "all members"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isCalculating ? (
              <div className="py-12 text-center text-gray-500 animate-pulse">
                Calculating optimal meeting times...
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-4">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-semibold text-lg">
                        #{idx + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {DAYS[suggestion.day_of_week]},{" "}
                          {formatSlotTime(suggestion.start_slot_index)} -{" "}
                          {formatSlotTime(suggestion.end_slot_index)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {suggestion.available_users} / {suggestion.total_users} members available
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                          suggestion.availability_percentage === 100
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : suggestion.availability_percentage >= 75
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {suggestion.availability_percentage === 100 && (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        {Math.round(suggestion.availability_percentage)}% Match
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center border rounded-lg border-dashed text-gray-500">
                <CalendarClock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No suitable times found</p>
                <p className="text-sm mt-1">Try adjusting the duration or target group.</p>
              </div>
            )}

            <div className="flex justify-center mt-6">
              <Button variant="outline" onClick={() => setStep(1)}>
                Start Over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
