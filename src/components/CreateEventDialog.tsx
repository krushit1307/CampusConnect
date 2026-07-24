import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useMutation } from "@/hooks/useReactQueryReplacement";
import { Plus, MapPin, CalendarIcon, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { createClient } from "@/lib/supabase/client";
import { eventFormSchema, TITLE_MAX_LENGTH, type EventFormValues } from "@/lib/eventUtils";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import { FlyerUploader } from "@/components/FlyerUploader";
import type { ParsedFlyer } from "@/lib/parser";

const STEPS = [
  { label: "Details" },
  { label: "Logistics" },
  { label: "FAQs" },
  { label: "Review" },
] as const;

type Step = 0 | 1 | 2 | 3;

const STEP_FIELDS: Record<Step, (keyof EventFormValues)[]> = {
  0: ["title", "description"],
  1: ["startDate", "endDate", "location"],
  2: [],
  3: [],
};

const defaultValues: EventFormValues = {
  title: "",
  description: "",
  location: "",
  startDate: "",
  endDate: "",
  faqs: [],
};

export function CreateEventDialog({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const supabase = createClient();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  const watchedLocation = useWatch({ control: form.control, name: "location" });
  const showMapPreview =
    watchedLocation &&
    watchedLocation.trim().length > 0 &&
    watchedLocation.trim().toLowerCase() !== "online";

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

      const startDateIso = new Date(values.startDate).toISOString();
      const endDateIso = new Date(values.endDate).toISOString();

      const { error } = await supabase.from("events").insert({
        title: values.title.trim(),
        description: values.description.trim(),
        location: values.location?.trim() || null,
        start_date: startDateIso,
        end_date: endDateIso,
        // Kept in sync with start_date so existing views that still
        // read event_date (e.g. EventCard, event ordering) keep working.
        event_date: startDateIso,
        created_by: user.id,
        faqs: values.faqs && values.faqs.length > 0 ? values.faqs : [],
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Event created!");
      window.dispatchEvent(new Event("refetchEvents"));
      form.reset(defaultValues);
      setStep(0);
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
      try {
        const d = new Date(data.date);
        if (!isNaN(d.getTime())) {
          form.setValue("startDate", `${format(d, "yyyy-MM-dd")}T12:00`, { shouldValidate: true });
          form.setValue("endDate", `${format(d, "yyyy-MM-dd")}T14:00`, { shouldValidate: true });
        }
      } catch (e) {
        console.error("Failed to parse date from flyer", e);
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
    if (!range) {
      form.setValue("startDate", "", { shouldValidate: true });
      form.setValue("endDate", "", { shouldValidate: true });
      return;
    }

    if (range.from) {
      const existingStartTime =
        startDateStr && startDateStr.includes("T") ? startDateStr.split("T")[1] : "00:00";
      form.setValue("startDate", `${format(range.from, "yyyy-MM-dd")}T${existingStartTime}`, {
        shouldValidate: true,
      });
    }

    if (range.to) {
      const existingEndTime =
        endDateStr && endDateStr.includes("T") ? endDateStr.split("T")[1] : "23:59";
      form.setValue("endDate", `${format(range.to, "yyyy-MM-dd")}T${existingEndTime}`, {
        shouldValidate: true,
      });
    } else {
      form.setValue("endDate", "", { shouldValidate: true });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          form.reset(defaultValues);
          setStep(0);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="neu-border neu-press flex items-center gap-2 bg-teal-500 px-4 py-2 font-mono text-xs font-bold uppercase text-black"
        >
          <Plus className="h-4 w-4" />
          Create event
        </button>
      </DialogTrigger>
      <DialogContent className="neu-border neu-shadow bg-cream sm:max-w-md text-black">
        <DialogHeader>
          <DialogTitle className="text-black">Create a new event</DialogTitle>
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
                  control={form.control}
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
                  control={form.control}
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
              </>
            )}

            {/* Step 2 — Logistics */}
            {step === 1 && (
              <>
                <FormField
                  control={form.control}
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
                  {form.formState.errors.startDate && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.startDate.message}
                    </p>
                  )}
                  {form.formState.errors.endDate && (
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
                        const datePart = startDateStr.split("T")[0];
                        form.setValue("startDate", `${datePart}T${time}`, { shouldValidate: true });
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
                        const datePart = endDateStr.split("T")[0];
                        form.setValue("endDate", `${datePart}T${time}`, { shouldValidate: true });
                      }}
                      disabled={!endDateStr}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Step 3 — FAQs (optional) */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="font-mono text-xs font-bold text-black/50 uppercase">
                  Add frequently asked questions (optional)
                </p>
                {form.watch("faqs")?.map((_faq, index) => (
                  <div key={index} className="neu-border space-y-2 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-black/40">
                        Q{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = form.getValues("faqs") || [];
                          form.setValue(
                            "faqs",
                            current.filter((_: unknown, i: number) => i !== index),
                          );
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
                        const updated = [...current];
                        updated[index] = { ...updated[index], question: e.target.value };
                        form.setValue("faqs", updated);
                      }}
                      className="font-mono text-sm"
                    />
                    <Textarea
                      placeholder="Answer"
                      value={form.watch(`faqs.${index}.answer`) || ""}
                      onChange={(e) => {
                        const current = form.getValues("faqs") || [];
                        const updated = [...current];
                        updated[index] = { ...updated[index], answer: e.target.value };
                        form.setValue("faqs", updated);
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
                    form.setValue("faqs", [...current, { question: "", answer: "" }]);
                  }}
                  className="w-full border-dashed font-mono text-xs font-bold"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Question
                </Button>
              </div>
            )}

            {/* Step 4 — Review (confirm) */}
            {step === 3 && (
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
            )}

            <DialogFooter className="flex gap-2 pt-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                  Back
                </Button>
              )}
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-black text-cream hover:bg-black/80"
                >
                  Next →
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createEvent.isPending}
                  className="flex-1 bg-black text-cream hover:bg-black/80"
                >
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
