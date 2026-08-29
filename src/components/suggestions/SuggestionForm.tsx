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
import { useCreateSuggestion } from "@/hooks/useSuggestions";
import { useSuggestionStore } from "@/store/useSuggestionStore";
import { CATEGORY_META, type SuggestionCategory } from "@/types/suggestions";
import { Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const suggestionSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(120, "Title must be at most 120 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(2000, "Description must be at most 2000 characters"),
  category: z.enum([
    "social",
    "academic",
    "sports",
    "cultural",
    "workshop",
    "hackathon",
    "volunteer",
    "other",
  ]),
  proposed_date: z.string().nullable(),
  proposed_location: z.string().max(200).nullable(),
  estimated_budget: z.number().min(0).max(1_000_000).nullable(),
  expected_attendees: z.number().min(1).max(50_000).nullable(),
});

type SuggestionFormData = z.infer<typeof suggestionSchema>;

interface SuggestionFormProps {
  userId: string;
  userName: string;
  userAvatar: string | null;
  clubId?: string | null;
}

export function SuggestionForm({
  userId,
  userName,
  userAvatar,
  clubId = null,
}: SuggestionFormProps) {
  const { isFormOpen, setFormOpen } = useSuggestionStore();
  const createSuggestion = useCreateSuggestion();
  const [charCount, setCharCount] = useState(0);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<SuggestionFormData>({
    resolver: zodResolver(suggestionSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "social",
      proposed_date: null,
      proposed_location: null,
      estimated_budget: null,
      expected_attendees: null,
    },
  });

  const descriptionValue = watch("description");

  const onSubmit = (data: SuggestionFormData) => {
    createSuggestion.mutate({
      payload: {
        ...data,
        club_id: clubId,
      },
      userId,
      userName,
      userAvatar,
    });
    reset();
    setCharCount(0);
  };

  const handleClose = () => {
    setFormOpen(false);
    reset();
    setCharCount(0);
  };

  const suggestedDate = watch("proposed_date");

  return (
    <Dialog open={isFormOpen} onOpenChange={(open) => (open ? setFormOpen(true) : handleClose())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Suggest an Event
          </DialogTitle>
          <DialogDescription>
            Have an idea for a campus event? Submit your suggestion and let the community vote!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="suggestion-title" className="text-sm font-semibold">
              Event Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="suggestion-title"
              placeholder="e.g., Annual Campus Music Festival"
              {...register("title")}
              className={cn(errors.title && "border-red-400 focus-visible:ring-red-400")}
            />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="suggestion-desc" className="text-sm font-semibold">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="suggestion-desc"
              placeholder="Describe your event idea — what, why, and how it benefits the campus community..."
              rows={5}
              {...register("description", {
                onChange: (e) => setCharCount(e.target.value.length),
              })}
              className={cn(
                "resize-none",
                errors.description && "border-red-400 focus-visible:ring-red-400",
              )}
            />
            <div className="flex items-center justify-between">
              {errors.description ? (
                <p className="text-xs text-red-500">{errors.description.message}</p>
              ) : (
                <span />
              )}
              <span
                className={cn(
                  "text-xs font-mono",
                  charCount > 1800 ? "text-red-500" : "text-gray-400",
                )}
              >
                {charCount}/2000
              </span>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Category <span className="text-red-500">*</span>
            </Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(CATEGORY_META) as SuggestionCategory[]).map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const isSelected = field.value === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => field.onChange(cat)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 text-xs font-medium transition-all",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                        )}
                      >
                        <span className="text-lg">{meta.icon}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>

          {/* Date & Location row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="suggestion-date" className="text-sm font-semibold">
                Proposed Date
              </Label>
              <Input
                id="suggestion-date"
                type="date"
                {...register("proposed_date")}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggestion-location" className="text-sm font-semibold">
                Proposed Location
              </Label>
              <Input
                id="suggestion-location"
                placeholder="e.g., Main Auditorium"
                {...register("proposed_location")}
              />
            </div>
          </div>

          {/* Budget & Expected Attendees */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="suggestion-budget" className="text-sm font-semibold">
                Estimated Budget ($)
              </Label>
              <Input
                id="suggestion-budget"
                type="number"
                min={0}
                placeholder="0"
                {...register("estimated_budget", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="suggestion-attendees" className="text-sm font-semibold">
                Expected Attendees
              </Label>
              <Input
                id="suggestion-attendees"
                type="number"
                min={1}
                placeholder="100"
                {...register("expected_attendees", { valueAsNumber: true })}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="rounded-full">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || createSuggestion.isPending}
              className="rounded-full gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {createSuggestion.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {createSuggestion.isPending ? "Submitting..." : "Submit Suggestion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
