import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { triggerConfetti } from "@/utils/confetti";
import {
  clubFormSchema,
  type ClubFormValues,
} from "@/lib/clubUtils";
import { Wizard, type WizardStep } from "@/components/wizard/Wizard";
import { SiteShell } from "@/components/site/SiteShell";
import { Input } from "@/components/ui/input";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { CascadingCategorySelect } from "@/components/Clubs/CascadingCategorySelect";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface ClubWizardFormValues extends ClubFormValues {
  logo_url?: string;
}

const defaultValues: ClubWizardFormValues = {
  name: "",
  slug: "",
  description: "",
  visibility: "public",
  category_id: null,
  social_links: {},
};

const STORAGE_KEY = "campusconnect.club-wizard";

const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
};

export default function CreateClubWizard() {
  const supabase = createClient();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ClubWizardFormValues>({
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

  const handleSubmitted = async () => {
    const valid = await form.trigger();
    if (!valid) {
      toast.error("Please fix the highlighted fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create a club.");
        return;
      }

      const values = form.getValues();

      const { data: existingClub } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", values.slug.trim())
        .maybeSingle();

      if (existingClub) {
        toast.error(
          "A club with this slug already exists. Please choose a different name or edit the slug.",
        );
        return;
      }

      const { error } = await supabase.from("clubs").insert({
        name: values.name.trim(),
        slug: values.slug.trim(),
        description: values.description.trim(),
        logo_url: values.logo_url || null,
        category_id: values.category_id || null,
        github_repo_url: values.github_repo_url ?? null,
        social_links: values.social_links ?? {},
        visibility: values.visibility,
        created_by: user.id,
        status: "pending",
      });

      if (error) throw error;

      sessionStorage.removeItem(STORAGE_KEY);
      toast.success("Club submitted for administrator review.");
      triggerConfetti();
      window.dispatchEvent(new Event("refetchClubs"));
      navigate("/clubs");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Couldn't create the club. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: WizardStep<ClubWizardFormValues>[] = useMemo(
    () => [
      {
        id: "basic-info",
        title: "Basic Info",
        description: "Start with the essentials: the club's name, web address, and category.",
        fields: ["name", "slug", "category_id"],
        render: () => (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Club Name</FormLabel>
                    <FormControl>
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
                    <FormLabel required>Web Address Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="ai-research-group" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Club Category</FormLabel>
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
          </div>
        ),
      },
      {
        id: "constitution",
        title: "Constitution",
        description: "Describe your club's mission, goals, and the GitHub repo backing it.",
        fields: ["description"],
        render: () => (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Club Description (Markdown)</FormLabel>
                  <FormControl>
                    <MarkdownEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Write about your club's mission and constitution..."
                      rows={8}
                      minHeightClass="min-h-48"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="github_repo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GitHub Repository URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://github.com/your-org/club-repo"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ),
      },
      {
        id: "socials",
        title: "Socials",
        description: "Link your club's social profiles so members can follow along.",
        fields: [],
        render: () => (
          <div className="space-y-4">
            <SocialLinkField
              form={form}
              name="twitter"
              label="Twitter / X URL"
              placeholder="https://x.com/your-club"
            />
            <SocialLinkField
              form={form}
              name="instagram"
              label="Instagram URL"
              placeholder="https://instagram.com/your-club"
            />
            <SocialLinkField
              form={form}
              name="website"
              label="Website URL"
              placeholder="https://your-club.example.com"
            />
          </div>
        ),
      },
      {
        id: "logo",
        title: "Logo",
        description: "Upload a square logo — it appears on the club's profile and badge.",
        fields: ["logo_url"],
        render: () => (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-5">
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
        ),
      },
      {
        id: "review",
        title: "Review",
        description: "Double-check everything before you submit for administrator review.",
        fields: [],
        render: () => <ReviewSummary form={form} />,
      },
    ],
    [form],
  );

  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display uppercase tracking-widest text-black mb-2">
            Create a Club
          </h1>
          <p className="font-mono text-xs text-gray-500">
            Five quick steps. Your progress is saved as you type, so refreshing the page never loses
            your work.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <Wizard
              form={form}
              steps={steps}
              storageKey={STORAGE_KEY}
              basePath="/clubs/new"
              isSubmitting={isSubmitting}
              submitLabel="Submit Club"
              onSubmitted={handleSubmitted}
            />
          </form>
        </Form>
      </div>
    </SiteShell>
  );
}

function SocialLinkField({
  form,
  name,
  label,
  placeholder,
}: {
  form: ReturnType<typeof useForm<ClubWizardFormValues>>;
  name: string;
  label: string;
  placeholder: string;
}) {
  const links = form.watch("social_links") ?? {};
  const value = links[name] ?? "";

  return (
    <div>
      <label className="block font-mono text-xs font-bold uppercase text-black mb-2">{label}</label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          form.setValue(
            "social_links",
            { ...(form.watch("social_links") ?? {}), [name]: e.target.value },
            { shouldDirty: true },
          )
        }
      />
    </div>
  );
}

function ReviewSummary({ form }: { form: ReturnType<typeof useForm<ClubWizardFormValues>> }) {
  const values = form.watch();

  const rows = [
    { label: "Club Name", value: values.name },
    { label: "Web Address", value: values.slug ? `/clubs/${values.slug}` : "" },
    { label: "Description", value: values.description },
    { label: "GitHub Repo", value: values.github_repo_url ?? "" },
    { label: "Visibility", value: values.visibility },
  ];

  return (
    <div className="space-y-3">
      {rows.map(
        (row) =>
          row.value && (
            <div
              key={row.label}
              className="flex items-start justify-between gap-4 border-b border-dashed border-black pb-2"
            >
              <span className="font-mono text-xs font-bold uppercase text-gray-600 shrink-0">
                {row.label}
              </span>
              <span className="font-mono text-xs text-black text-right break-all">{row.value}</span>
            </div>
          ),
      )}
      {values.logo_url && (
        <div className="flex items-center justify-between gap-4 border-b border-dashed border-black pb-2">
          <span className="font-mono text-xs font-bold uppercase text-gray-600 shrink-0">Logo</span>
          <img
            src={values.logo_url}
            alt="Club Logo"
            className="h-10 w-10 rounded-full border-2 border-black object-cover"
          />
        </div>
      )}
      {!values.name && (
        <p className="font-mono text-xs text-gray-500">
          Nothing to review yet — go back and fill in the steps.
        </p>
      )}
    </div>
  );
}
