import { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@/hooks/useReactQueryReplacement";
import { checkEventConflicts, EventConflict } from "@/lib/events/checkEventConflicts";
import { useNavigate } from "react-router-dom";
import { useUndoableState } from "@/hooks/useUndoableState";
import Plus from "lucide-react/dist/esm/icons/plus";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Check from "lucide-react/dist/esm/icons/check";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import X from "lucide-react/dist/esm/icons/x";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import type { DateRange } from "react-day-picker";

import format from "date-fns/format";
import { createClient } from "@/lib/supabase/client";
import {
  checkOrganizerPostMortemGate,
  searchClubPostMortems,
  findHistoricalRetrospectiveSuggestions,
  type PendingPostMortemEvent,
  type EventPostMortem,
} from "@/services/eventPostMortemService";
import { PostMortemGatingModal } from "@/components/events/PostMortemGatingModal";
import {
  eventFormSchema,
  TITLE_MAX_LENGTH,
  hasDraftContent,
  eventFormToDbPayload,
  parseFlyerDate,
  applyDateRangeSelection,
  updateTimeInDate,
  addFaq,
  removeFaq,
  updateFaq,
  DEFAULT_EVENT_TAG_OPTIONS,
  RESOURCE_OPTIONS,
  type EventFormValues,
} from "@/lib/eventUtils";
import { EventLogisticsService } from "@/services/eventLogisticsService";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { queueOfflineEvent } from "@/lib/offlineSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { FlyerUploader } from "@/components/FlyerUploader";
import type { ParsedFlyer } from "@/lib/parser";
import { MultiSelect } from "@/components/MultiSelect";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import {
  GeofenceMapPicker,
  MIN_GEOFENCE_RADIUS_METERS,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from "@/components/GeofenceMapPicker";

const STEPS = [
  { label: "Details", fields: ["title", "description"] as const },
  { label: "Logistics", fields: ["location", "latitude", "startDate", "endDate"] as const },
  { label: "Media", fields: [] as const },
  { label: "Review", fields: [] as const },
] as const;

const STEP_FIELDS = STEPS.map((s) => s.fields as unknown as (keyof EventFormValues)[]);

type Step = 0 | 1 | 2 | 3;

// Define an extended interface locally to handle the extra location field safely
interface LocalEventFormValues extends EventFormValues {
  location?: string;
  alcoholPresent?: boolean;
  maxAttendees?: number;
  offCampusSpeaker?: boolean;
  requiresApproval?: boolean;
  requiresSignature?: boolean;
  ndaTemplateUrl?: string;
}
const defaultValues: LocalEventFormValues = {
  title: "",
  description: "",
  category: "",
  venue_id: "",
  location: "",
  latitude: null,
  longitude: null,
  geofencingEnabled: false,
  geofenceRadiusMeters: 100,
  accessibility_features: {
    has_elevator: false,
    wheelchair_ramp: false,
    gender_neutral_restrooms: false,
    hearing_loop: false,
    low_sensory_zone: false,
  },
  startDate: "",
  endDate: "",
  alcoholPresent: false,
  maxAttendees: undefined,
  offCampusSpeaker: false,
  requiresApproval: false,
  requiresSignature: false,
  ndaTemplateUrl: undefined,
  isPrivate: false,
  tags: [],
  faqs: [],
};
const DRAFT_KEY = "event_draft";
const DRAFT_AUTOSAVE_INTERVAL_MS = 5000;

export function CreateEventDialog({
  user,
  variant = "default",
}: {
  user: User | null;
  /** "fab" renders a compact circular icon-only trigger for use inside ScrollAwareFab (#1232) */
  variant?: "default" | "fab";
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [clubId, setClubId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [isSuggestingCategories, setIsSuggestingCategories] = useState(false);
  const [conflicts, setConflicts] = useState<EventConflict[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [showConflictWizard, setShowConflictWizard] = useState(false);
  const navigate = useNavigate();
  const supabase = createClient();
  const isOnline = useOnlineStatus();

  // Issue #2082: Strip time to block past dates properly without timezone bugs
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: categories = [] } = useQuery({
    queryKey: ["eventCategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_categories")
        .select("id, name")
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("status", "approved")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setClubId(data.club_id);
      });
  }, [user]);

  const form = useForm<any>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { data: venues } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("venues").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const watchedLocation = form.watch("location");
  const watchedTitle = form.watch("title");
  const watchedDescription = form.watch("description");
  const watchedVenueId = form.watch("venue_id");
  const control = form.control as never;

  useEffect(() => {
    const title = String(watchedTitle || "").trim();
    const description = String(watchedDescription || "").trim();

    if (!title && !description) {
      setAiSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsSuggestingCategories(true);

      try {
        const { data, error } = await supabase.functions.invoke("smart-auto-categorize", {
          body: {
            title,
            description,
            club_id: clubId,
            suggest_only: true,
          },
        });

        if (error) {
          console.warn("AI category suggestion failed:", error);
          setAiSuggestions([]);
          return;
        }

        setAiSuggestions(data?.categories || []);
      } catch (error) {
        console.warn("AI category suggestion failed:", error);
        setAiSuggestions([]);
      } finally {
        setIsSuggestingCategories(false);
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [watchedTitle, watchedDescription, clubId]);

  // Post-Mortem Gating & Historical Retrospective Suggestions
  const [showGatingModal, setShowGatingModal] = useState(false);

  const { data: gatingStatus, refetch: refetchGating } = useQuery({
    queryKey: ["organizer_post_mortem_gate", user?.id, clubId],
    queryFn: () => (user ? checkOrganizerPostMortemGate(user.id, clubId) : null),
    enabled: Boolean(user && open),
  });

  const { data: pastRetrospectives } = useQuery<EventPostMortem[]>({
    queryKey: ["club_past_retrospectives", clubId],
    queryFn: () => (clubId ? searchClubPostMortems(clubId) : []),
    enabled: Boolean(clubId && open),
  });

  const historicalSuggestions = useMemo(() => {
    if (!pastRetrospectives || pastRetrospectives.length === 0) return [];
    return findHistoricalRetrospectiveSuggestions(
      String(watchedTitle || ""),
      String(watchedDescription || ""),
      pastRetrospectives,
    );
  }, [watchedTitle, watchedDescription, pastRetrospectives]);

  const isUndoingRedoingRef = useRef(false);
  const {
    state: undoableState,
    set: setUndoableState,
    undo,
    redo,
    resetState,
  } = useUndoableState(defaultValues, 1000);

  const watchedValues = form.watch();
  const watchedValuesJson = JSON.stringify(watchedValues);

  // Reset/initialize undoable state when the modal opens/closes
  useEffect(() => {
    if (open) {
      resetState(form.getValues());
    }
  }, [open, resetState, form]);

  // Sync form inputs to the undoable state history
  useEffect(() => {
    if (isUndoingRedoingRef.current) {
      isUndoingRedoingRef.current = false;
      return;
    }
    const currentUndoableJson = JSON.stringify(undoableState);
    if (watchedValuesJson !== currentUndoableJson) {
      setUndoableState(JSON.parse(watchedValuesJson));
    }
  }, [watchedValuesJson, undoableState, setUndoableState]);

  // Sync undoableState back to form values
  useEffect(() => {
    const currentFormValues = form.getValues();
    if (JSON.stringify(currentFormValues) !== JSON.stringify(undoableState)) {
      isUndoingRedoingRef.current = true;
      form.reset(undoableState);
    }
  }, [undoableState, form]);

  // Add Ctrl+Z and Ctrl+Y keydown shortcut listener
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
            toast.success("Redo action performed");
          } else {
            undo();
            toast.success("Undo action performed");
          }
        } else if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          redo();
          toast.success("Redo action performed");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, undo, redo]);

  const watchedGeofencingEnabled = form.watch("geofencingEnabled");
  const watchedLatitude = form.watch("latitude");
  const watchedLongitude = form.watch("longitude");
  const watchedGeofenceRadius = form.watch("geofenceRadiusMeters");

  const currentDescription = watchedDescription || "";

  const isCustomVenue = watchedVenueId === "custom";

  const showMapPreview =
    isCustomVenue &&
    watchedLocation &&
    watchedLocation.trim().length > 0 &&
    watchedLocation.trim().toLowerCase() !== "online";

  // Auto-save the in-progress draft to localStorage every 5 seconds while
  // the dialog is open, so it survives a refresh or browser crash.
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      const values = form.getValues();
      if (!hasDraftContent(values)) return;

      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      } catch (e) {
        console.error("[CreateEventDialog] Failed to save draft to localStorage:", e);
      }
    }, DRAFT_AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [open, form]);

  const handleNext = async () => {
    const valid = await form.trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => setStep((s) => (s - 1) as Step);

  const createEvent = useMutation({
    mutationFn: async (values: EventFormValues) => {
      if (!user) {
        throw new Error("You must be logged in to create an event.");
      }

      if (gatingStatus?.is_locked && gatingStatus.pending_events?.length > 0) {
        setShowGatingModal(true);
        throw new Error(
          `Event creation locked: You have ${gatingStatus.pending_count} pending post-mortem retrospective(s) to complete first.`,
        );
      }

      const payload = eventFormToDbPayload(values, user.id, clubId);

      // If user is currently offline, queue in IndexedDB & Background Sync immediately
      if (!navigator.onLine) {
        await queueOfflineEvent(payload);
        return { isOffline: true };
      }

      try {
        const { data: createdData, error } = await supabase
          .from("events")
          .insert(payload)
          .select(
            "id, event_date, start_date, max_attendees, capacity, has_catering, has_food, tags",
          )
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (createdData?.id && values.resourceNeeds && values.resourceNeeds.length > 0) {
          try {
            const { error: resourceError } = await supabase.from("event_resource_requests").insert({
              event_id: createdData.id,
              resources: values.resourceNeeds,
              status: "pending",
              provider: "zendesk", // Default extensible provider
            });
            if (resourceError) {
              console.warn("Failed to log resource request:", resourceError);
            } else {
              supabase.functions
                .invoke("submit-resource-ticket", {
                  body: { eventId: createdData.id },
                })
                .catch((err) => console.warn("Failed to invoke submit-resource-ticket:", err));
            }
          } catch (e) {
            console.warn("Resource req fail", e);
          }
        }

        if (createdData?.id) {
          try {
            await EventLogisticsService.syncAutoGeneratedTasks(createdData.id, createdData);
          } catch (ruleErr) {
            console.warn("Failed to sync auto logistics tasks:", ruleErr);
          }
        }

        return { isOffline: false };
      } catch (err: unknown) {
        const isNetworkError =
          !navigator.onLine ||
          (err instanceof Error &&
            (err.message.includes("Failed to fetch") ||
              err.message.includes("NetworkError") ||
              err.message.includes("network")));

        if (isNetworkError) {
          await queueOfflineEvent(payload);
          return { isOffline: true };
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      if (data?.isOffline) {
        toast.info(
          "Event saved offline! It will sync automatically when connectivity is restored.",
          { duration: 6000 },
        );
      } else {
        toast.success("Event created!");
      }
      window.dispatchEvent(new Event("refetchEvents"));
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch (e) {
        console.error("[CreateEventDialog] Failed to clear saved draft:", e);
      }
      form.reset(defaultValues);
      resetState(defaultValues);
      setOpen(false);
    },
    onError: (error: Error) => {
      console.error("[CreateEventDialog] Failed to create event:", error);
      toast.error(error.message || "Couldn't create the event. Please try again.");
    },
  });

  const onSubmit = async (values: EventFormValues) => {
    if (showConflictWizard) {
      createEvent.mutate(values);
      return;
    }

    setIsCheckingConflicts(true);
    try {
      const detectedConflicts = await checkEventConflicts(supabase, values);
      if (detectedConflicts.length > 0) {
        setConflicts(detectedConflicts);
        setShowConflictWizard(true);
      } else {
        createEvent.mutate(values);
      }
    } catch (err) {
      console.error(err);
      createEvent.mutate(values);
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  const handleDataExtracted = (data: ParsedFlyer) => {
    if (data.title) form.setValue("title", data.title, { shouldValidate: true });
    if (data.description) form.setValue("description", data.description, { shouldValidate: true });
    if (data.date) {
      const parsed = parseFlyerDate(data.date);
      if (parsed) {
        form.setValue("startDate", parsed.startDate, { shouldValidate: true });
        form.setValue("endDate", parsed.endDate, { shouldValidate: true });
      }
    }
  };

  const startDateStr = form.watch("startDate");
  const endDateStr = form.watch("endDate");

  const parsedStart = startDateStr ? new Date(startDateStr) : undefined;
  const parsedEnd = endDateStr ? new Date(endDateStr) : undefined;

  const dateRange: DateRange | undefined = parsedStart
    ? {
        from: parsedStart,
        to: parsedEnd,
      }
    : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    const { startDate, endDate } = applyDateRangeSelection(range, startDateStr, endDateStr);
    form.setValue("startDate", startDate, { shouldValidate: true });
    form.setValue("endDate", endDate, { shouldValidate: true });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          try {
            const saved = window.localStorage.getItem(DRAFT_KEY);
            if (saved) {
              const draftValues = JSON.parse(saved) as EventFormValues;
              if (hasDraftContent(draftValues)) {
                toast("You have an unsaved draft.", {
                  description: "Would you like to resume where you left off?",
                  action: {
                    label: "Resume",
                    onClick: () => {
                      form.reset(draftValues);
                      resetState(draftValues);
                    },
                  },
                });
              }
            }
          } catch (e) {
            console.error("[CreateEventDialog] Failed to read saved draft:", e);
          }
        } else {
          form.reset(defaultValues);
          setStep(0);
        }
      }}
    >
      <DialogTrigger asChild>
        {variant === "fab" ? (
          <button
            type="button"
            aria-label="Create event"
            className="neu-border neu-press flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <Plus className="h-6 w-6" />
          </button>
        ) : (
          <button
            type="button"
            className="neu-border neu-press flex items-center gap-2 bg-teal-500 px-4 py-2 font-mono text-xs font-bold uppercase text-black"
          >
            <Plus className="h-4 w-4" />
            Create event
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="neu-border neu-shadow bg-cream sm:max-w-md text-black max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-black">Create a new event</DialogTitle>
            {!isOnline && (
              <div className="neu-border flex items-center gap-1.5 bg-amber-200 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black">
                <WifiOff className="h-3 w-3 shrink-0" />
                <span>Offline Mode</span>
              </div>
            )}
          </div>
          <DialogDescription className="text-black/60">
            Step {step + 1} of {STEPS.length} — {STEPS[step].label}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "neu-border flex h-7 w-7 items-center justify-center font-mono text-xs font-bold transition-colors",
                  i < step
                    ? "bg-black text-cream"
                    : i === step
                      ? "bg-lime text-black"
                      : "bg-white text-black/40",
                )}
              >
                {i < step ? <Check size={12} /> : i + 1}
              </div>
              <span
                className={cn(
                  "font-mono text-[10px] font-bold uppercase",
                  i === step ? "text-black" : "text-black/40",
                )}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {showConflictWizard && conflicts.length > 0 && (
              <div className="border-2 border-red-500 bg-red-50 p-4 mb-4">
                <div className="flex items-center gap-2 mb-2 text-red-700 font-bold">
                  <AlertTriangle size={20} />
                  <h3>Conflict Detected</h3>
                </div>
                <p className="text-sm text-red-900 mb-4">
                  There are other high-capacity events with overlapping audiences scheduled at the
                  same time. This may affect your attendance.
                </p>
                <div className="space-y-3">
                  {conflicts.map((c) => (
                    <div
                      key={c.id}
                      className="bg-white border border-red-200 p-3 rounded-md flex justify-between items-center"
                    >
                      <div>
                        <div className="font-bold text-sm">{c.title}</div>
                        <div className="text-xs text-gray-500">by {c.club?.name || "a club"}</div>
                      </div>
                      {c.club?.created_by && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex gap-2"
                          onClick={() => {
                            const msg = encodeURIComponent(
                              `⚠️ Coordination: Our upcoming event "${form.watch("title")}" might overlap with "${c.title}". Should we coordinate?`,
                            );
                            navigate(`/messages?userId=${c.club.created_by}&message=${msg}`);
                          }}
                        >
                          <MessageSquare size={14} /> Message President
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1 — Details */}
            {step === 0 && (
              <>
                <FlyerUploader onDataExtracted={handleDataExtracted} />
                <FormField
                  control={control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Hackathon 2026"
                          maxLength={TITLE_MAX_LENGTH}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What's this event about?" rows={4} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Historical Retrospective Institutional Memory Suggestions */}
                {historicalSuggestions.length > 0 && (
                  <div className="border-2 border-amber-500 bg-amber-50 p-3 shadow-[2px_2px_0_0_#000]">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-black uppercase text-amber-950 mb-1">
                      <span>💡 Institutional Memory Tip</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] text-amber-900">
                      {historicalSuggestions.map((s, idx) => (
                        <p key={idx}>
                          • From <strong>{s.eventTitle}</strong> ({s.keyword}): &quot;{s.advice}&quot;
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <FormField
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>{" "}
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {(isSuggestingCategories || aiSuggestions.length > 0) && (
                  <div className="rounded-lg border-2 border-dashed border-black/30 bg-yellow-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="font-mono text-xs font-bold uppercase text-black">
                          AI Suggested Tags
                        </p>
                        <p className="text-xs text-black/60">
                          Suggestions are based on the event title and description.
                        </p>
                      </div>

                      {isSuggestingCategories && (
                        <span className="text-xs font-mono font-bold">Analyzing...</span>
                      )}
                    </div>

                    {!isSuggestingCategories && aiSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {aiSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => {
                              const currentTags = form.getValues("tags") || [];

                              form.setValue("category", suggestion.id, {
                                shouldValidate: true,
                              });

                              form.setValue(
                                "tags",
                                [...new Set([...currentTags, suggestion.name])].slice(0, 10),
                                { shouldValidate: true },
                              );
                            }}
                            className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-bold hover:bg-black hover:text-white"
                          >
                            {suggestion.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {!isSuggestingCategories && aiSuggestions.length > 0 && (
                      <p className="mt-3 text-xs text-black/50">
                        Click a suggestion to use it. You can still change the category or tags
                        manually.
                      </p>
                    )}
                  </div>
                )}
                <FormField
                  control={control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs font-bold uppercase text-black">
                        Event Tags
                      </FormLabel>
                      <FormControl>
                        <MultiSelect
                          value={(field.value || []).map((tag: string) => ({
                            value: tag,
                            label: tag,
                          }))}
                          onChange={(tags) => field.onChange(tags.map((t) => t.value))}
                          options={DEFAULT_EVENT_TAG_OPTIONS}
                          placeholder="Select or type event tags (e.g. #Tech, #Career)..."
                          allowCustom={true}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="dress_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dress Code</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select event dress code (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No Specific Dress Code</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="smart_casual">Smart Casual</SelectItem>
                          <SelectItem value="business_casual">Business Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="isPrivate"
                  render={({ field }) => (
                    <FormItem className="neu-border flex items-center justify-between bg-white p-3 shadow-none">
                      <div className="space-y-0.5">
                        <FormLabel className="cursor-pointer font-mono text-xs font-bold uppercase text-black">
                          Private Event (Members Only)
                        </FormLabel>
                        <p className="text-[11px] text-black/60">
                          Restrict visibility to approved members of the hosting club.
                        </p>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border-2 border-black accent-teal-500 cursor-pointer"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Step 2 — Logistics */}
            {step === 1 && (
              <>
                <FormField
                  control={control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='e.g. "Main Auditorium" or "28.7041,77.1025" or "Online"'
                          {...field}
                        />
                      </FormControl>
                      <p className="mt-1 text-xs text-black/50">
                        Enter a venue name, address, or coordinates (lat,lng)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showMapPreview && (
                  <div className="overflow-hidden border-2 border-black">
                    <iframe
                      className="w-full"
                      height="160"
                      loading="lazy"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(watchedLocation)}&output=embed`}
                      title="Location preview"
                    />

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(watchedLocation)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 bg-white py-1.5 font-mono text-xs font-bold underline hover:bg-cream"
                    >
                      <MapPin size={12} />
                      Open in Google Maps ↗
                    </a>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="venue_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-red-800" required>
                        Venue
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl className="text-black">
                          <SelectTrigger>
                            <SelectValue placeholder="Select a venue" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {venues?.map((v: any) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name} ({v.capacity} capacity)
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Custom Location</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isCustomVenue && (
                  <>
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-red-800" required>
                            Custom Location
                          </FormLabel>
                          <FormControl className="text-black">
                            <Input
                              placeholder='e.g. "Main Auditorium, IIT Bombay" or "Online"'
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-black/50 mt-1">
                            Enter a venue name, address, or "Online"
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchedLocation?.trim().toLowerCase() !== "online" && (
                      <div className="border border-black p-3 rounded-md bg-white/50 space-y-2">
                        <FormLabel className="text-red-800 text-sm font-bold block mb-2">
                          Accessibility Audit
                        </FormLabel>
                        <p className="text-xs text-black/70 mb-2">
                          Please accurately report the venue's accessibility features.
                        </p>

                        {[
                          { id: "has_elevator", label: "Elevator Available" },
                          { id: "wheelchair_ramp", label: "Wheelchair Ramp Available" },
                          { id: "gender_neutral_restrooms", label: "Gender-Neutral Restrooms" },
                          { id: "hearing_loop", label: "Hearing Loop Available" },
                          { id: "low_sensory_zone", label: "Low-Sensory/Quiet Zone" },
                        ].map((feature) => (
                          <FormField
                            key={feature.id}
                            control={form.control}
                            name={`accessibility_features.${feature.id}` as any}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border-0 p-1">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-black">
                                    {feature.label}
                                  </FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    )}

                    {showMapPreview && (
                      <div className="rounded overflow-hidden border-2 border-black">
                        <iframe
                          className="w-full"
                          height="180"
                          loading="lazy"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(watchedLocation || "")}&output=embed`}
                          title="Location preview"
                        />
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(watchedLocation || "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 bg-white py-1.5 font-mono text-xs font-bold underline hover:bg-cream"
                        >
                          <MapPin size={12} />
                          Open in Google Maps ↗
                        </a>
                      </div>
                    )}
                  </>
                )}
                <FormField
                  control={control}
                  name="is_outdoor"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border-2 border-black bg-white p-4 shadow-sm">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-bold cursor-pointer">Outdoor Event</FormLabel>
                        <p className="text-xs text-black/50">
                          Mark this as an outdoor event to enable automated weather alerts.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("is_outdoor") && (
                  <FormField
                    control={control}
                    name="backup_indoor_venue"
                    render={({ field }) => (
                      <FormItem className="rounded-md border-2 border-black bg-white p-4">
                        <FormLabel className="font-bold">Backup Indoor Venue</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Student Union Hall"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <p className="mt-1 text-xs text-black/50">
                          If severe weather is forecasted, you will be prompted to automatically
                          pivot the event here.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={control}
                  name="geofencingEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border-2 border-black bg-white p-4 shadow-sm">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-bold cursor-pointer">
                          Require Geofenced Check-in
                        </FormLabel>
                        <p className="text-xs text-black/50">
                          Attendees must be physically near the venue (verified via GPS) to check
                          themselves in. Turn this off for indoor venues with poor GPS reception —
                          you can still check attendees in manually at the door.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="requiresSignature"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border-2 border-black bg-white p-4 shadow-sm">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-bold cursor-pointer">
                          Requires NDA Signature
                        </FormLabel>
                        <p className="text-xs text-black/50">
                          Attendees must digitally sign an NDA before their RSVP is confirmed.
                          Recommended for talks involving unreleased products or confidential
                          material.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("requiresSignature") && (
                  <FormField
                    control={control}
                    name="ndaTemplateUrl"
                    render={({ field }) => (
                      <FormItem className="rounded-md border-2 border-black bg-white p-4">
                        <FormLabel className="font-bold">NDA Template (PDF)</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="application/pdf"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const path = `${Date.now()}-${file.name}`;
                              const { error: uploadError } = await supabase.storage
                                .from("event_nda_templates")
                                .upload(path, file);
                              if (uploadError) {
                                toast.error("Failed to upload NDA template");
                                return;
                              }
                              const { data: publicUrlData } = supabase.storage
                                .from("event_nda_templates")
                                .getPublicUrl(path);
                              field.onChange(publicUrlData.publicUrl);
                            }}
                          />
                        </FormControl>
                        <p className="mt-1 text-xs text-black/50">
                          Attendees will be shown this document to review and sign before RSVP.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {watchedGeofencingEnabled && (
                  <div className="space-y-3 rounded-md border-2 border-black bg-white p-4">
                    <GeofenceMapPicker                      latitude={watchedLatitude}
                      longitude={watchedLongitude}
                      radiusMeters={watchedGeofenceRadius || DEFAULT_GEOFENCE_RADIUS_METERS}
                      onChange={({ latitude, longitude }) => {
                        form.setValue("latitude", latitude, { shouldValidate: true });
                        form.setValue("longitude", longitude, { shouldValidate: true });
                      }}
                    />
                    {(form.formState.errors as Record<string, { message?: string }>)?.latitude && (
                      <p className="text-red-500 text-xs" aria-live="polite">
                        {
                          (form.formState.errors as Record<string, { message?: string }>).latitude
                            ?.message
                        }
                      </p>
                    )}

                    <FormField
                      control={control}
                      name="geofenceRadiusMeters"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Check-in Radius: {field.value || 100} meters</FormLabel>
                          <FormControl>
                            <input
                              type="range"
                              min={MIN_GEOFENCE_RADIUS_METERS}
                              max={1000}
                              step={10}
                              value={field.value || DEFAULT_GEOFENCE_RADIUS_METERS}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              className="w-full accent-teal-500"
                            />
                          </FormControl>
                          <p className="mt-1 text-xs text-black/50">
                            How close (in meters) attendees must be to the pin to check in. 50–100m
                            works well for a single building; use a larger radius for outdoor venues
                            like a quad or stadium.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="eyebrow font-bold text-sm">
                    Event Date Range <span className="text-destructive">*</span>
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDateStr && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDateStr ? (
                          endDateStr ? (
                            <>
                              {format(parsedStart!, "LLL dd, y")} –{" "}
                              {format(parsedEnd!, "LLL dd, y")}
                            </>
                          ) : (
                            format(parsedStart!, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={parsedStart}
                        selected={dateRange}
                        onSelect={handleSelect}
                        numberOfMonths={2}
                        disabled={{ before: today }}
                        modifiersClassNames={{
                          selected: "bg-blue-600 text-white font-bold",
                          range_start: "rounded-l-md bg-blue-600 text-white",
                          range_end: "rounded-r-md bg-blue-600 text-white",
                          range_middle: "bg-blue-100 text-blue-900 rounded-none",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {typeof form.formState.errors.startDate?.message === "string" && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.startDate.message}
                    </p>
                  )}
                  {typeof form.formState.errors.endDate?.message === "string" && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.endDate.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="eyebrow font-bold text-sm">
                      Start Time <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="time"
                      value={startDateStr ? startDateStr.split("T")[1] || "" : ""}
                      onChange={(e) => {
                        const time = e.target.value;
                        if (!startDateStr) return;
                        form.setValue("startDate", updateTimeInDate(startDateStr, time), {
                          shouldValidate: true,
                        });
                      }}
                      disabled={!startDateStr}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="eyebrow font-bold text-sm">
                      End Time <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="time"
                      value={endDateStr ? endDateStr.split("T")[1] || "" : ""}
                      onChange={(e) => {
                        const time = e.target.value;
                        if (!endDateStr) return;
                        form.setValue("endDate", updateTimeInDate(endDateStr, time), {
                          shouldValidate: true,
                        });
                      }}
                      disabled={!endDateStr}
                    />
                  </div>
                </div>

                <FormField
                  control={control}
                  name="resourceNeeds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs font-bold uppercase text-black">
                        Resource Needs (IT & Facilities)
                      </FormLabel>
                      <FormControl>
                        <MultiSelect
                          value={(field.value || []).map((res: string) => {
                            const option = RESOURCE_OPTIONS.find((o) => o.value === res);
                            return { value: res, label: option?.label || res };
                          })}
                          onChange={(resources) => field.onChange(resources.map((r) => r.value))}
                          options={RESOURCE_OPTIONS}
                          placeholder="Select required resources..."
                          allowCustom={true}
                        />
                      </FormControl>
                      <p className="mt-1 text-xs text-black/50">
                        Automatically opens a ticket with the provider (e.g. Zendesk) for requested
                        items.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Step 3 — Media & Ticketing */}
            {step === 2 && (
              <div className="space-y-6">
                <FormField
                  control={control}
                  name="banner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banner Image</FormLabel>
                      <ImageCropUpload
                        aspect={16 / 9}
                        bucket="event-banners"
                        value={field.value || undefined}
                        onUploaded={(url) => field.onChange(url, { shouldValidate: true })}
                        hint="JPEG, PNG or WEBP · Max 5 MB · 16:9 crop"
                      />
                      <p className="mt-1 text-xs text-black/50">Or paste a URL directly:</p>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/banner.png"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticket Capacity</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} placeholder="e.g. 100" {...field} />
                      </FormControl>
                      <p className="mt-1 text-xs text-black/50">
                        Max number of attendees (optional, leave blank for unlimited)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <p className="font-mono text-xs font-bold text-black/50 uppercase">
                  Add frequently asked questions (optional)
                </p>
                {form.watch("faqs")?.map((_faq: unknown, index: number) => (
                  <div key={index} className="neu-border space-y-2 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-black/40">
                        Q{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = form.getValues("faqs") || [];
                          form.setValue("faqs", removeFaq(current, index));
                        }}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Input
                      placeholder="Question"
                      value={form.watch(`faqs.${index}.question`) || ""}
                      onChange={(e) => {
                        const current = form.getValues("faqs") || [];
                        form.setValue(
                          "faqs",
                          updateFaq(current, index, "question", e.target.value),
                        );
                      }}
                      className="font-mono text-sm"
                    />
                    <Textarea
                      placeholder="Answer"
                      value={form.watch(`faqs.${index}.answer`) || ""}
                      onChange={(e) => {
                        const current = form.getValues("faqs") || [];
                        form.setValue("faqs", updateFaq(current, index, "answer", e.target.value));
                      }}
                      rows={2}
                      className="font-mono text-sm"
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const current = form.getValues("faqs") || [];
                    form.setValue("faqs", addFaq(current));
                  }}
                  className="w-full border-dashed font-mono text-xs font-bold"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Question
                </Button>
              </div>
            )}

            {/* Step 4 — Review (confirm) */}
            {step === 3 && (
              <>
                <div className="neu-border space-y-3 bg-white p-4 font-mono text-sm">
                  <p className="font-bold uppercase text-black/50 text-xs">Review your event</p>
                  <div>
                    <p className="text-xs text-black/40">Title</p>
                    <p className="font-bold">{form.getValues("title")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-black/40">Description</p>
                    <p className="text-black/80">{form.getValues("description")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-black/40">Category</p>
                    <p className="font-bold">
                      {categories.find((c) => c.id === form.getValues("category"))?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-black/40">Location</p>
                    <p>{form.getValues("location") || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-black/40">Geofenced Check-in</p>
                    <p className="font-bold">
                      {watchedGeofencingEnabled
                        ? `On — ${form.getValues("geofenceRadiusMeters") || 100}m radius`
                        : "Off — manual/QR check-in only"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-black/40">Start</p>
                      <p>{startDateStr ? format(parsedStart!, "MMM dd, y HH:mm") : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-black/40">End</p>
                      <p>{endDateStr ? format(parsedEnd!, "MMM dd, y HH:mm") : "—"}</p>
                    </div>
                  </div>
                  {form.getValues("faqs") && form.getValues("faqs").length > 0 && (
                    <div>
                      <p className="text-xs text-black/40">FAQs</p>
                      <p className="font-bold">{form.getValues("faqs").length} question(s)</p>
                    </div>
                  )}
                </div>

                <FormField
                  control={control}
                  name="requiresApproval"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border-2 border-black bg-white p-4 shadow-sm">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-bold cursor-pointer">
                          Requires Manual Approval
                        </FormLabel>
                        <p className="text-xs text-black/50">
                          Organizers must manually approve attendee RSVPs.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="border-t-2 border-dashed border-black pt-4 mt-4 space-y-4">
              <p className="font-mono text-xs font-bold uppercase text-black">
                Risk & Attendance Details
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-row items-center justify-between rounded-lg border-2 border-black p-3 bg-white">
                  <div className="space-y-0.5">
                    <label className="text-sm font-bold">Alcohol Present</label>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 border-2 border-black"
                    checked={form.watch("alcoholPresent") || false}
                    onChange={(e) => form.setValue("alcoholPresent", e.target.checked)}
                  />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border-2 border-black p-3 bg-white">
                  <div className="space-y-0.5">
                    <label className="text-sm font-bold">Off-Campus Speaker</label>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 border-2 border-black"
                    checked={form.watch("offCampusSpeaker") || false}
                    onChange={(e) => form.setValue("offCampusSpeaker", e.target.checked)}
                  />
                </div>
              </div>

              <div>
                <label className="font-mono text-xs font-bold uppercase text-black block mb-1">
                  Expected Attendance / Capacity
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 150"
                  className="border-2 border-black bg-white"
                  value={form.watch("maxAttendees") || ""}
                  onChange={(e) =>
                    form.setValue(
                      "maxAttendees",
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                />
              </div>
            </div>

            <DialogFooter className="pt-2 flex gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={handleNext} className="ml-auto">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createEvent.isPending || isCheckingConflicts}
                  className="ml-auto"
                >
                  {createEvent.isPending
                    ? "Creating..."
                    : isCheckingConflicts
                      ? "Checking..."
                      : showConflictWizard
                        ? "Publish Anyway"
                        : "Create event"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
      {gatingStatus?.pending_events && (
        <PostMortemGatingModal
          isOpen={showGatingModal}
          pendingEvents={gatingStatus.pending_events}
          onClose={() => setShowGatingModal(false)}
          onSuccess={() => {
            setShowGatingModal(false);
            refetchGating();
          }}
        />
      )}
    </Dialog>
  );
}
