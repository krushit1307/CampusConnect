import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreatePoll } from "@/hooks/usePolls";
import { usePollStore } from "@/store/usePollStore";
import { POLL_TYPE_META, POLL_TARGET_META } from "@/types/polls";
import type { PollType, PollTarget } from "@/types/polls";
import { Plus, Trash2, Send, Loader2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const pollSchema = z.object({
  question: z.string().min(5, "Min 5 characters").max(300, "Max 300 characters"),
  poll_type: z.enum(["single", "multiple", "yes_no"]),
  target: z.enum(["campus", "club", "event"]),
  is_anonymous: z.boolean(),
  expires_at: z.string().nullable(),
});

type PollFormData = z.infer<typeof pollSchema>;

interface PollFormProps {
  userId: string;
  userName: string;
  userAvatar: string | null;
  clubId?: string | null;
  eventId?: string | null;
}

export function PollForm({
  userId,
  userName,
  userAvatar,
  clubId = null,
  eventId = null,
}: PollFormProps) {
  const { isFormOpen, setFormOpen } = usePollStore();
  const createPoll = useCreatePoll();
  const [optionTexts, setOptionTexts] = useState<string[]>(["", ""]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<PollFormData>({
    resolver: zodResolver(pollSchema),
    defaultValues: {
      question: "",
      poll_type: "single",
      target: "campus",
      is_anonymous: false,
      expires_at: null,
    },
  });

  const pollType = watch("poll_type");

  const addOption = () => {
    if (optionTexts.length < 8) setOptionTexts([...optionTexts, ""]);
  };
  const removeOption = (idx: number) => {
    if (optionTexts.length > 2) setOptionTexts(optionTexts.filter((_, i) => i !== idx));
  };
  const updateOption = (idx: number, val: string) => {
    const next = [...optionTexts];
    next[idx] = val;
    setOptionTexts(next);
  };

  const onSubmit = (data: PollFormData) => {
    const options =
      pollType === "yes_no"
        ? []
        : optionTexts.filter((t) => t.trim()).map((text) => ({ text: text.trim() }));

    if (pollType !== "yes_no" && options.length < 2) return;

    createPoll.mutate({
      payload: {
        ...data,
        club_id: clubId,
        event_id: eventId,
        allow_write_in: false,
        options,
      },
      userId,
      userName,
      userAvatar,
    });
    reset();
    setOptionTexts(["", ""]);
  };

  const handleClose = () => {
    setFormOpen(false);
    reset();
    setOptionTexts(["", ""]);
  };

  return (
    <Dialog open={isFormOpen} onOpenChange={(open) => (open ? setFormOpen(true) : handleClose())}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            Create a Poll
          </DialogTitle>
          <DialogDescription>
            Ask a question and let the community vote. Results update in real-time.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-3">
          {/* Question */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Question <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="e.g., What time should the next meetup be?"
              rows={2}
              {...register("question")}
              className={cn("resize-none", errors.question && "border-red-400")}
            />
            {errors.question && <p className="text-xs text-red-500">{errors.question.message}</p>}
          </div>

          {/* Type + Target */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Poll Type</Label>
              <Controller
                name="poll_type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(POLL_TYPE_META) as PollType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {POLL_TYPE_META[t].icon} {POLL_TYPE_META[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Target</Label>
              <Controller
                name="target"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(POLL_TARGET_META) as PollTarget[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {POLL_TARGET_META[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Options (hidden for yes/no) */}
          {pollType !== "yes_no" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Options</Label>
                <span className="text-xs text-gray-400 font-mono">{optionTexts.length}/8</span>
              </div>
              {optionTexts.map((text, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder={`Option ${idx + 1}`}
                    value={text}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    className="h-9 text-sm flex-1"
                  />
                  {optionTexts.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(idx)}
                      className="h-9 w-9 p-0 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {optionTexts.length < 8 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  className="rounded-full text-xs gap-1.5"
                >
                  <Plus className="h-3 w-3" /> Add Option
                </Button>
              )}
            </div>
          )}

          {pollType === "yes_no" && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              Yes / No options will be created automatically.
            </div>
          )}

          {/* Anonymous toggle + expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                {...register("is_anonymous")}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="anonymous" className="text-sm cursor-pointer">
                Anonymous votes
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Expires</Label>
              <Input type="datetime-local" {...register("expires_at")} className="h-9 text-xs" />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="rounded-full">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createPoll.isPending}
              className="rounded-full gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {createPoll.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {createPoll.isPending ? "Creating..." : "Create Poll"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
