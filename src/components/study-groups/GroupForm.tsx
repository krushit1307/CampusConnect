import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Controller } from "react-hook-form";
import { useCreateStudyGroup } from "@/hooks/useStudyGroups";
import { useStudyGroupStore } from "@/store/useStudyGroupStore";
import { PRIVACY_META, type GroupPrivacy } from "@/types/studyGroups";
import { Send, Loader2, BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

const groupSchema = z.object({
  name: z.string().min(3, "Min 3 characters").max(80, "Max 80 characters"),
  description: z.string().max(500).nullable(),
  course_code: z.string().max(20).nullable(),
  course_name: z.string().max(100).nullable(),
  privacy: z.enum(["public", "private", "invite_only"]),
  max_members: z.number().min(2).max(200).nullable(),
  meeting_location: z.string().max(200).nullable(),
});

type GroupFormData = z.infer<typeof groupSchema>;

interface GroupFormProps {
  userId: string;
  userName: string;
  userAvatar: string | null;
}

export function GroupForm({ userId, userName, userAvatar }: GroupFormProps) {
  const { isFormOpen, setFormOpen } = useStudyGroupStore();
  const createGroup = useCreateStudyGroup();
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      description: null,
      course_code: null,
      course_name: null,
      privacy: "public",
      max_members: null,
      meeting_location: null,
    },
  });

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (t: string) => setTags(tags.filter((tag) => tag !== t));

  const onSubmit = (data: GroupFormData) => {
    createGroup.mutate({
      payload: { ...data, tags },
      userId,
      userName,
      userAvatar,
    });
    reset();
    setTags([]);
  };

  const handleClose = () => {
    setFormOpen(false);
    reset();
    setTags([]);
  };

  return (
    <Dialog open={isFormOpen} onOpenChange={(open) => (open ? setFormOpen(true) : handleClose())}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            Create Study Group
          </DialogTitle>
          <DialogDescription>Start a study group for your course or topic.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Group Name <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="e.g., CS301 Study Squad"
              {...register("name")}
              className={cn(errors.name && "border-red-400")}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Description</Label>
            <Textarea
              placeholder="What will this group focus on?"
              rows={2}
              {...register("description")}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Course Code</Label>
              <Input placeholder="CS301" {...register("course_code")} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Course Name</Label>
              <Input
                placeholder="Data Structures"
                {...register("course_name")}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Privacy</Label>
              <Controller
                name="privacy"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIVACY_META) as GroupPrivacy[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIVACY_META[p].icon} {PRIVACY_META[p].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Max Members</Label>
              <Input
                type="number"
                min={2}
                max={200}
                placeholder="No limit"
                {...register("max_members", { valueAsNumber: true })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Meeting Location</Label>
            <Input
              placeholder="Library Room 204"
              {...register("meeting_location")}
              className="h-9 text-sm"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="h-9 text-sm flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addTag}
                className="h-9 rounded-full text-xs"
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px] gap-1">
                    #{t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="ml-0.5 hover:text-red-500"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="rounded-full">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createGroup.isPending}
              className="rounded-full gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {createGroup.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Create Group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
