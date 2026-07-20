import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useMutation } from "@/hooks/useReactQueryReplacement";
import { Plus, MapPin, CalendarIcon } from "lucide-react";
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

const defaultValues: EventFormValues = {
  title: "",
  description: "",
  location: "",
  startDate: "",
  endDate: "",
};

export function CreateEventDialog({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
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
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Event created!");
      // Invalidate queries is handled by realtime subscriptions if needed or refresh
      window.dispatchEvent(new Event("refetchEvents"));
      form.reset(defaultValues);
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
      <DialogContent className="neu-border neu-shadow bg-violet-500 sm:max-w-md text-black">
        <DialogHeader>
          <DialogTitle className="text-blue-900">Create a new event</DialogTitle>
          <DialogDescription className="text-black">
            Fill in the details below. All fields are required.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required className="text-red-800">
                    Title
                  </FormLabel>
                  <FormControl className="text-black">
                    <Input placeholder="Hackathon 2026" maxLength={TITLE_MAX_LENGTH} {...field} />
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
                  <FormLabel required className="text-red-800">
                    Description
                  </FormLabel>
                  <FormControl className="text-black">
                    <Textarea placeholder="What's this event about?" rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-red-800">Location</FormLabel>
                  <FormControl className="text-black">
                    <Input
                      placeholder='e.g. "Main Auditorium, IIT Bombay" or "28.7041,77.1025" or "Online"'
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-black/50 mt-1">
                    Enter a venue name, address, or coordinates (lat,lng)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showMapPreview && (
              <div className="rounded overflow-hidden border-2 border-black">
                <iframe
                  className="w-full"
                  height="180"
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

            <div className="space-y-4">
              <FormItem className="flex flex-col">
                <FormLabel required>Event Date Range</FormLabel>
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
                            {format(parsedStart!, "LLL dd, y")} - {format(parsedEnd!, "LLL dd, y")}
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
                <FormMessage>{form.formState.errors.startDate?.message}</FormMessage>
                <FormMessage>{form.formState.errors.endDate?.message}</FormMessage>
              </FormItem>

              <div className="grid grid-cols-2 gap-4">
                <FormItem>
                  <FormLabel required>Start Time</FormLabel>
                  <FormControl>
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
                  </FormControl>
                </FormItem>
                <FormItem>
                  <FormLabel required>End Time</FormLabel>
                  <FormControl>
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
                  </FormControl>
                </FormItem>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" disabled={createEvent.isPending} className="w-full sm:w-auto">
                {createEvent.isPending ? "Creating..." : "Create event"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
