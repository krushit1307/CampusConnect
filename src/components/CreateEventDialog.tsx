import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

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

const defaultValues: EventFormValues = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
};

export function CreateEventDialog({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
    mode: "onBlur",
  });

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
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["upcomingEvents"] });
      form.reset(defaultValues);
      setOpen(false);
    },
    onError: (error: Error) => {
      console.error("[CreateEventDialog] Failed to create event:", error);
      toast.error("Couldn't create the event. Please try again.");
    },
  });

  const onSubmit = (values: EventFormValues) => {
    createEvent.mutate(values);
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
          className="neu-border neu-press flex items-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream"
        >
          <Plus className="h-4 w-4" />
          Create event
        </button>
      </DialogTrigger>
      <DialogContent className="neu-border neu-shadow bg-cream sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new event</DialogTitle>
          <DialogDescription>Fill in the details below. All fields are required.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Title</FormLabel>
                  <FormControl>
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
                  <FormLabel required>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What's this event about?" rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Start date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>End date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
