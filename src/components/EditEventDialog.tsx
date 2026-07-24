import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Edit3, GitMerge } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { eventFormSchema, TITLE_MAX_LENGTH, type EventFormValues } from "@/lib/eventUtils";
import {
  EventDocument,
  FieldConflict,
  mergeEventDocuments,
  VersionVector,
} from "@/lib/conflictResolution";
import { ConflictResolutionModal } from "@/components/ConflictResolutionModal";
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

interface EditEventDialogProps {
  event: EventDocument;
  user: User | null;
  onSuccess?: () => void;
}

export function EditEventDialog({ event, user, onSuccess }: EditEventDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const [mergedDoc, setMergedDoc] = useState<EventDocument | null>(null);
  const [baseSnapshot, setBaseSnapshot] = useState<EventDocument>(event);

  const supabase = createClient();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: event.title || "",
      description: event.description || "",
      location: event.location || "",
      startDate: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : "",
      endDate: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "",
    },
    mode: "onBlur",
  });

  useEffect(() => {
    if (open) {
      setBaseSnapshot(event);
      form.reset({
        title: event.title || "",
        description: event.description || "",
        location: event.location || "",
        startDate: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : "",
        endDate: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "",
      });
    }
  }, [open, event, form]);

  const executeSave = async (docToSave: EventDocument) => {
    if (!event.id) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("events")
        .update({
          title: docToSave.title,
          description: docToSave.description,
          location: docToSave.location || null,
          start_date: docToSave.start_date,
          end_date: docToSave.end_date,
          event_date: docToSave.start_date,
          tags: docToSave.tags || [],
          version_vector: docToSave.version_vector || {},
          version: (docToSave.version || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      if (error) throw new Error(error.message);

      toast.success("Event updated with CRDT differential merge!");
      window.dispatchEvent(new Event("refetchEvents"));
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("[EditEventDialog] Save error:", err);
      toast.error("Failed to update event. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormSubmit = async (values: EventFormValues) => {
    if (!user || !event.id) return;
    setIsSaving(true);

    try {
      // 1. Fetch latest server state to detect concurrent edits
      const { data: latestServerEvent, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", event.id)
        .single();

      if (error || !latestServerEvent) {
        throw new Error(error?.message || "Failed to fetch current server state");
      }

      const localDoc: EventDocument = {
        ...baseSnapshot,
        title: values.title.trim(),
        description: values.description.trim(),
        location: values.location?.trim() || null,
        start_date: new Date(values.startDate).toISOString(),
        end_date: new Date(values.endDate).toISOString(),
        version_vector: (baseSnapshot.version_vector || {}) as VersionVector,
      };

      const serverDoc: EventDocument = latestServerEvent as EventDocument;

      // 2. Perform 3-way differential CRDT merge
      const mergeResult = mergeEventDocuments(baseSnapshot, localDoc, serverDoc, user.id);

      if (mergeResult.hasConflicts) {
        // 3. Unresolvable field conflict -> Prompt manual resolution modal UI
        setConflicts(mergeResult.conflicts);
        setMergedDoc(mergeResult.mergedDocument);
        setConflictModalOpen(true);
        setIsSaving(false);
      } else {
        // Auto-merged cleanly without data loss -> Save directly
        await executeSave(mergeResult.mergedDocument);
      }
    } catch (err) {
      console.error("[EditEventDialog] Submit error:", err);
      toast.error("Error evaluating concurrent event edits.");
      setIsSaving(false);
    }
  };

  const handleResolvedFromModal = async (resolvedDoc: EventDocument) => {
    await executeSave(resolvedDoc);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="neu-border neu-press flex items-center gap-1.5 bg-black px-3 py-1.5 font-mono text-xs font-bold uppercase text-cream"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Event
          </button>
        </DialogTrigger>
        <DialogContent className="neu-border neu-shadow bg-cream sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-black" />
              <DialogTitle>Edit Event Details</DialogTitle>
            </div>
            <DialogDescription>
              Edits are processed using 3-way differential sync to prevent concurrent data loss.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Event title" maxLength={TITLE_MAX_LENGTH} {...field} />
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
                      <Textarea placeholder="Event description" rows={3} {...field} />
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
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Location or Online" {...field} />
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
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                  {isSaving ? "Evaluating Edits..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {mergedDoc && (
        <ConflictResolutionModal
          open={conflictModalOpen}
          onOpenChange={setConflictModalOpen}
          conflicts={conflicts}
          mergedDocument={mergedDoc}
          onResolve={handleResolvedFromModal}
        />
      )}
    </>
  );
}
