import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Control } from "react-hook-form";
import Edit3 from "lucide-react/dist/esm/icons/edit-3";
import GitMerge from "lucide-react/dist/esm/icons/git-merge";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import {
  eventFormSchema,
  TITLE_MAX_LENGTH,
  DEFAULT_EVENT_TAG_OPTIONS,
  type EventFormValues,
} from "@/lib/eventUtils";
import { useQuery } from "@/hooks/useReactQueryReplacement";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MultiSelect } from "@/components/MultiSelect";
import { DateTimePicker } from "@/components/DateTimePicker";
import CollaborativeDescriptionEditor from "@/components/events/CollaborativeDescriptionEditor";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";

const EVENT_CONCURRENT_EDIT_CONFLICT = "EVENT_CONCURRENT_EDIT_CONFLICT";

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

  const form = useForm<any>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: event.title || "",
      description: event.description || "",
      tldr_summary: event.tldr_summary || "",
      category: (event.category_id as string) || "",
      location: event.location || "",
      latitude: typeof event.latitude === "number" ? event.latitude : null,
      longitude: typeof event.longitude === "number" ? event.longitude : null,
      is_outdoor: event.is_outdoor || false,
      has_photography: event.has_photography || false,
      backup_indoor_venue: event.backup_indoor_venue || "",
      startDate: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : "",
      endDate: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "",
      tags: event.tags || [],
    },
    mode: "onBlur",
  });

  const control = form.control as never;

  useEffect(() => {
    if (open) {
      setBaseSnapshot(event);
      form.reset({
        title: event.title || "",
        description: event.description || "",
        tldr_summary: event.tldr_summary || "",
        category: (event.category_id as string) || "",
        location: event.location || "",
        latitude: typeof event.latitude === "number" ? event.latitude : null,
        longitude: typeof event.longitude === "number" ? event.longitude : null,
        startDate: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : "",
        endDate: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "",
        tags: event.tags || [],
        has_photography: event.has_photography || false,
        is_outdoor: event.is_outdoor || false,
        backup_indoor_venue: event.backup_indoor_venue || "",
      });
    }
  }, [open, event, form]);

  const executeSave = async (docToSave: EventDocument) => {
    if (!event.id) return;
    setIsSaving(true);

    try {
      // Optimistic concurrency control: the version the document was merged
      // against (docToSave.version is the NEXT version to write, so the WHERE
      // predicate must target the CURRENT database version).
      const targetVersion = (docToSave.version || 1) - 1;

      const { data, error } = await supabase
        .from("events")
        .update({
          title: docToSave.title,
          description: docToSave.description,
          tldr_summary: docToSave.tldr_summary?.toString().trim() || null,
          tldr_summary_source: docToSave.tldr_summary?.toString().trim() ? "organizer" : "none",
          tldr_summary_error: null,
          category_id: docToSave.category_id || null,
          location: docToSave.location || null,
          is_outdoor: docToSave.is_outdoor || false,
          has_photography: docToSave.has_photography || false,
          backup_indoor_venue: docToSave.backup_indoor_venue || null,
          latitude: typeof docToSave.latitude === "number" ? docToSave.latitude : null,
          longitude: typeof docToSave.longitude === "number" ? docToSave.longitude : null,
          start_date: docToSave.start_date,
          end_date: docToSave.end_date,
          event_date: docToSave.start_date,
          tags: docToSave.tags || [],
          version_vector: docToSave.version_vector || {},
          version: docToSave.version || 1,
        })
        .eq("id", event.id)
        .eq("version", targetVersion)
        .select("id, version");

      if (error) throw new Error(error.message);

      // rowCount === 0 -> the database version no longer matches the version
      // this user fetched (another admin already bumped it). Reject the save.
      if (!data || data.length === 0) {
        await handleConcurrentConflict(docToSave);
        throw new Error(EVENT_CONCURRENT_EDIT_CONFLICT);
      }

      toast.success("Event updated with optimistic concurrency control!");
      window.dispatchEvent(new Event("refetchEvents"));
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      if (err instanceof Error && err.message === EVENT_CONCURRENT_EDIT_CONFLICT) {
        return;
      }
      console.error("[EditEventDialog] Save error:", err);
      toast.error("Failed to update event. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConcurrentConflict = async (docToSave: EventDocument) => {
    toast.error(
      "Conflict detected: This event was modified by another user while you were editing.",
    );

    // UI recovery: fetch the new database state and show exactly what changed
    // so the user never loses their work.
    const { data: freshServer, error: serverError } = await supabase
      .from("events")
      .select("*")
      .eq("id", event.id)
      .single();

    if (serverError || !freshServer) {
      toast.error("Failed to load the latest event state. Please refresh and try again.");
      return;
    }

    const serverDoc = freshServer as EventDocument;
    const localDraft: EventDocument = {
      ...docToSave,
      version: baseSnapshot.version || 1,
      version_vector: baseSnapshot.version_vector || {},
    };

    const mergeResult = mergeEventDocuments(
      baseSnapshot,
      localDraft,
      serverDoc,
      user?.id || "local-admin",
    );

    setConflicts(mergeResult.conflicts);
    setMergedDoc(mergeResult.mergedDocument);
    setConflictModalOpen(true);
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
        tldr_summary: values.tldr_summary?.trim() || null,
        category_id: values.category || null,
        location: values.location?.trim() || null,
        latitude: typeof values.latitude === "number" ? values.latitude : null,
        longitude: typeof values.longitude === "number" ? values.longitude : null,
        is_outdoor: values.is_outdoor || false,
        has_photography: values.has_photography || false,
        backup_indoor_venue: values.backup_indoor_venue?.trim() || null,
        start_date: new Date(values.startDate).toISOString(),
        end_date: new Date(values.endDate).toISOString(),
        tags: values.tags || [],
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
      if (err instanceof Error && err.message === EVENT_CONCURRENT_EDIT_CONFLICT) {
        // Conflict UI already surfaced by executeSave
        setIsSaving(false);
        return;
      }
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
                control={control}
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
                control={control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Description</FormLabel>
                    <FormControl>
                      <CollaborativeDescriptionEditor
                        eventId={event.id}
                        initialDescription={event.description || ""}
                        userId={user?.id || "anon"}
                        userName={user?.email?.split("@")[0] || "User"}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="tldr_summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feed TL;DR</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Optional one-sentence summary for the event feed"
                        maxLength={100}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      The automatic summary can be edited here before students see it. Leave blank
                      to use the generated summary or fallback.
                    </p>
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
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <LocationAutocomplete
                        value={field.value || ""}
                        latitude={form.watch("latitude")}
                        longitude={form.watch("longitude")}
                        placeholder='Search for a venue, address, or type "Online"'
                        onChange={(value, coordinates) => {
                          field.onChange(value);
                          form.setValue("latitude", coordinates?.latitude ?? null);
                          form.setValue("longitude", coordinates?.longitude ?? null);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="is_outdoor"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="mt-1"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer font-medium">Outdoor Event</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Mark this as an outdoor event to enable automated weather alerts.
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="has_photography"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="mt-1"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer font-medium">
                        Photography or filming planned
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        RSVP checkout will require attendees to choose Yes or No for media consent.
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
                    <FormItem className="rounded-md border p-4">
                      <FormLabel>Backup Indoor Venue</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Student Union Hall"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <p className="mt-1 text-xs text-muted-foreground">
                        If severe weather is forecasted, you will be prompted to automatically pivot
                        the event here.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Start date</FormLabel>
                      <FormControl>
                        <DateTimePicker value={field.value || ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>End date</FormLabel>
                      <FormControl>
                        <DateTimePicker value={field.value || ""} onChange={field.onChange} />
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
