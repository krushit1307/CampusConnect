import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@/hooks/useReactQueryReplacement";
import Plus from "lucide-react/dist/esm/icons/plus";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import {
  clubFormSchema,
  MAX_DESCRIPTION_LENGTH,
  type ClubFormValues,
  type ClubFormInput,
} from "@/lib/clubUtils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/MarkdownEditor";
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
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { CascadingCategorySelect } from "@/components/Clubs/CascadingCategorySelect";
import { useConfetti } from "@/hooks/useConfetti";

const defaultValues: ClubFormInput = {
  name: "",
  slug: "",
  description: "",
  visibility: "public",
  category_id: null,
};

const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric/spaces/hyphens
    .replace(/[\s_]+/g, "-") // replace spaces and underscores with hyphens
    .replace(/-+/g, "-"); // remove duplicate hyphens
};

interface LocalClubFormValues extends ClubFormInput {
  logo_url?: string;
}

export function CreateClubDialog({ user }: { user: User | null }) {
  const { fireCannon } = useConfetti();
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const form = useForm<LocalClubFormValues>({
    resolver: zodResolver(clubFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  const nameValue = form.watch("name");

  useEffect(() => {
    const isSlugDirty = form.getFieldState("slug").isDirty;
    if (!isSlugDirty && nameValue) {
      form.setValue("slug", generateSlug(nameValue), { shouldValidate: true });
    }
  }, [nameValue, form]);

  const createClub = useMutation({
    mutationFn: async (values: LocalClubFormValues) => {
      if (!user) {
        throw new Error("You must be logged in to create a club.");
      }

      // Check if slug is unique
      const { data: existingClub } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", values.slug.trim())
        .maybeSingle();

      if (existingClub) {
        throw new Error(
          "A club with this slug already exists. Please choose a different name or edit the slug.",
        );
      }

      // Insert club
      const { data: newClub, error } = await supabase
        .from("clubs")
        .insert({
          name: values.name.trim(),
          slug: values.slug.trim(),
          description: sanitizeHtml(values.description.trim()),
          logo_url: values.logo_url || null,
          category_id: values.category_id || null,
          created_by: user.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Automatically add creator as admin member
      if (newClub) {
        // First, get the admin role for this club
        const { data: adminRole, error: roleError } = await supabase
          .from("club_roles")
          .select("id")
          .eq("club_id", newClub.id)
          .eq("title", "Admin")
          .single();

        if (roleError || !adminRole) {
          console.error("[CreateClubDialog] Failed to get admin role:", roleError);
        } else {
          const { error: memberError } = await supabase.from("club_members").insert({
            club_id: newClub.id,
            user_id: user.id,
            role_id: adminRole.id,
            status: "approved",
          });
          if (memberError) {
            console.error("[CreateClubDialog] Failed to add creator as member:", memberError);
          }
        }
      }
    },
    onSuccess: () => {
      fireCannon();
      toast.success("Club submitted for administrator review.");
      window.dispatchEvent(new Event("refetchClubs"));
      form.reset(defaultValues);
      setOpen(false);
    },
    onError: (error: Error) => {
      console.error("[CreateClubDialog] Failed to create club:", error);
      toast.error(error.message || "Couldn't create the club. Please try again.");
    },
  });

  const onSubmit = (values: LocalClubFormValues) => {
    const parsed = clubFormSchema.parse(values);
    createClub.mutate({ ...parsed, logo_url: values.logo_url });
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
          className="neu-border neu-press flex items-center gap-2 bg-sky px-4 py-2 font-mono text-sm font-bold uppercase text-black"
        >
          <Plus className="h-4 w-4" />
          Create a Club
        </button>
      </DialogTrigger>
      <DialogContent className="neu-border neu-shadow bg-violet-500 sm:max-w-2xl text-black">
        <DialogHeader>
          <DialogTitle className="text-blue-900">Create a new club</DialogTitle>
          <DialogDescription className="text-black">
            Submit a new club or student chapter. An administrator will review it before it appears
            publicly.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Club Logo Uploader */}
            <div className="flex flex-col items-center gap-3 bg-white/20 p-4 border-2 border-black sm:flex-row sm:items-center sm:gap-5">
              <div className="relative shrink-0">
                <div className="neu-border flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-lime">
                  {form.watch("logo_url") ? (
                    <img
                      src={form.watch("logo_url")!}
                      alt="Club Logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-lg font-bold text-black">
                      {form.watch("name")
                        ? form
                            .watch("name")
                            .split(" ")
                            .filter(Boolean)
                            .map((p: string) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "CL"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <p className="eyebrow font-bold text-black mb-1">Club Logo</p>
                <ImageCropUpload
                  aspect={1}
                  bucket="avatars"
                  value={form.watch("logo_url") ?? undefined}
                  onUploaded={(url) =>
                    form.setValue("logo_url", url, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  accept="image/jpeg,image/png,image/webp"
                  maxSizeBytes={2 * 1024 * 1024}
                  hint="JPG, PNG or WEBP · Max 2 MB · Fixed 1:1 crop"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required className="text-red-900">
                      Club Name
                    </FormLabel>
                    <FormControl className="text-black">
                      <Input placeholder="AI Research Group" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required className="text-red-900">
                      Web Address Slug
                    </FormLabel>
                    <FormControl className="text-black">
                      <Input placeholder="ai-research-group" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => {
                const currentLength = field.value?.length ?? 0;
                const isNearLimit = currentLength >= MAX_DESCRIPTION_LENGTH - 10;

                return (
                  <FormItem className="text-black">
                    <FormLabel required className="text-red-900">
                      Club Description (Markdown)
                    </FormLabel>

                    <FormControl>
                      <MarkdownEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Write about your club..."
                        rows={6}
                        minHeightClass="min-h-36"
                      />
                    </FormControl>

                    <div
                      className={`mt-1 text-right text-xs ${
                        isNearLimit ? "text-red-500" : "text-black"
                      }`}
                    >
                      {currentLength}/{MAX_DESCRIPTION_LENGTH}
                    </div>

                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem className="text-black">
                  <FormLabel required className="text-red-900">
                    Club Category
                  </FormLabel>
                  <FormControl>
                    <CascadingCategorySelect
                      value={field.value ?? null}
                      onChange={(categoryId) =>
                        form.setValue("category_id", categoryId, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="submit" disabled={createClub.isPending} className="w-full sm:w-auto">
                {createClub.isPending ? "Submitting..." : "Submit Club"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
