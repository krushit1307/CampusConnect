import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useMutation } from "@/hooks/useReactQueryReplacement";
import Plus from "lucide-react/dist/esm/icons/plus";
import X from "lucide-react/dist/esm/icons/x";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import {
  pollFormSchema,
  POLL_MIN_OPTIONS,
  POLL_MAX_OPTIONS,
  type PollFormValues,
} from "@/lib/pollUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface CreatePollDialogProps {
  eventId: string;
  user: User;
  onPollCreated?: () => void;
}

export function CreatePollDialog({ eventId, user, onPollCreated }: CreatePollDialogProps) {
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const form = useForm<PollFormValues>({
    resolver: zodResolver(pollFormSchema),
    defaultValues: {
      question: "",
      options: [{ text: "" }, { text: "" }],
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const createPoll = useMutation({
    mutationFn: async (values: PollFormValues) => {
      const { error: deactivateError } = await supabase
        .from("polls")
        .update({ is_active: false })
        .eq("event_id", eventId)
        .eq("is_active", true);

      if (deactivateError) throw deactivateError;

      const { data: poll, error: pollError } = await supabase
        .from("polls")
        .insert({
          event_id: eventId,
          created_by: user.id,
          question: values.question,
          is_active: true,
        })
        .select()
        .single();

      if (pollError) throw pollError;

      const optionsToInsert = values.options.map((opt, index) => ({
        poll_id: poll.id,
        text: opt.text,
        position: index,
      }));

      const { error: optionsError } = await supabase.from("poll_options").insert(optionsToInsert);

      if (optionsError) throw optionsError;

      const channel = supabase.channel(`poll_launch_${eventId}`);
      await channel.send({
        type: "broadcast",
        event: "poll_launch",
        payload: { pollId: poll.id },
      });
      supabase.removeChannel(channel);

      return poll;
    },
    onSuccess: () => {
      toast.success("Poll launched successfully!");
      setOpen(false);
      form.reset({ question: "", options: [{ text: "" }, { text: "" }] });
      onPollCreated?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create poll. Please try again.");
    },
  });

  const handleSubmit = (values: PollFormValues) => {
    createPoll.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="neu-border neu-press h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          Launch Poll
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md neu-border bg-cream">
        <DialogHeader>
          <DialogTitle className="font-display font-bold uppercase text-xl text-blue-900">
            Create Live Poll
          </DialogTitle>
          <DialogDescription className="font-mono text-sm">
            Ask a question and let attendees vote in real time.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required className="font-mono font-bold">
                    Question
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="What do you want to ask?"
                      className="neu-border font-mono text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-mono text-sm font-bold">Options</label>
                <span className="font-mono text-xs text-black/40">
                  {fields.length}/{POLL_MAX_OPTIONS}
                </span>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black bg-cream font-mono text-xs font-bold">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <FormField
                    control={form.control}
                    name={`options.${index}.text`}
                    render={({ field: fieldProps }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            {...fieldProps}
                            placeholder={`Option ${index + 1}`}
                            className="neu-border font-mono text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {fields.length > POLL_MIN_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black bg-white text-black/60 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}

              {fields.length < POLL_MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={() => append({ text: "" })}
                  className="flex w-full items-center justify-center gap-2 border-2 border-dashed border-black/30 py-2 font-mono text-xs font-bold uppercase text-black/50 transition-colors hover:border-black/60 hover:text-black"
                >
                  <Plus className="h-3 w-3" />
                  Add Option
                </button>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={createPoll.isPending}
                variant="primary"
                className="font-mono font-bold uppercase w-full sm:w-auto"
              >
                {createPoll.isPending ? "Launching..." : "Launch Poll"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
