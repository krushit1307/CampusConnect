import { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@/hooks/useReactQueryReplacement";
import { useUndoableState } from "@/hooks/useUndoableState";
import {
  Plus,
  MapPin,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import type { DateRange } from "react-day-picker";

import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
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
  type EventFormValues,
} from "@/lib/eventUtils";
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
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { FlyerUploader } from "@/components/FlyerUploader";
import type { ParsedFlyer } from "@/lib/parser";
import { TagMultiSelect } from "@/components/ui/TagMultiSelect";
import { ImageCropUpload } from "@/components/ImageCropUpload";

const STEPS = [
  { label: "Details", fields: ["title", "description"] as const },
  { label: "Logistics", fields: ["location", "startDate", "endDate"] as const },
  { label: "Media", fields: [] as const },
  { label: "Review", fields: [] as const },
] as const;

const STEP_FIELDS = STEPS.map((s) => s.fields as unknown as (keyof EventFormValues)[]);

type Step = 0 | 1 | 2 | 3;

// Define an extended interface locally to handle the extra location field safely
interface LocalEventFormValues extends EventFormValues {
  location?: string;
  requiresApproval?: boolean;
}

const defaultValues: LocalEventFormValues = {
  title: "",
  description: "",
  category: "",
  location: "",
  startDate: "",
  endDate: "",
  requiresApproval: false,
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
  const supabase = createClient();
  const isOnline = useOnlineStatus();

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  const control = form.control as never;

  const isUndoingRedoingRef = useRef(false);
  const {
    state: undoableState,
    set: setUndoableState,
    undo,
    redo,
    resetState,
  } = useUndoableState(defaultValues, 1000);

  const watchedValues = form.watch();

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
    setUndoableState(watchedValues);
  }, [watchedValues, setUndoableState]);

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

  // Watch values via form.watch to keep TypeScript quiet about schema property limits
  const watchedLocation = form.watch("location");
  const watchedDescription = form.watch("description");

  const currentDescription = watchedDescription || "";

  const showMapPreview =
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

      const payload = eventFormToDbPayload(values, user.id, clubId);

      // If user is currently offline, queue in IndexedDB & Background Sync immediately
      if (!navigator.onLine) {
        await queueOfflineEvent(payload);
        return { isOffline: true };
      }

      try {
        const { error } = await supabase.from("events").insert(payload);
        if (error) {
          throw new Error(error.message);
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

  const onSubmit = (values: EventFormValues) => {
    createEvent.mutate(values);
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
                    onClick: () => form.reset(draftValues),
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
      <DialogContent className="neu-border neu-shadow bg-cream sm:max-w-md text-black">
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
                <FormField
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Category</FormLabel>
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
                <FormField
                  control={control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs font-bold uppercase text-black">
                        Event Tags
                      </FormLabel>
                      <FormControl>
                        <TagMultiSelect
                          value={field.value || []}
                          onChange={field.onChange}
                          placeholder="Select or type event tags (e.g. #Tech, #Career)..."
                        />
                      </FormControl>
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
                <Button type="submit" disabled={createEvent.isPending} className="ml-auto">
                  {createEvent.isPending ? "Creating..." : "Create event"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
