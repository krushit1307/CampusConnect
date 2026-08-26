import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Mail from "lucide-react/dist/esm/icons/mail";
import UserCheck from "lucide-react/dist/esm/icons/user-check";

import { createClient } from "@/lib/supabase/client";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { triggerConfetti } from "@/utils/confetti";
import { clubFormSchema, type ClubFormValues } from "@/lib/clubUtils";
import { Wizard, type WizardStep } from "@/components/wizard/Wizard";
import { SiteShell } from "@/components/site/SiteShell";
import { Input } from "@/components/ui/input";
import { ImageCropUpload } from "@/components/ImageCropUpload";
import { CascadingCategorySelect } from "@/components/Clubs/CascadingCategorySelect";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { SmartTagSuggester } from "@/components/Clubs/SmartTagSuggester";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { useClubWizardStore, type AdminInvite } from "@/store/useClubWizardStore";

interface ClubWizardFormValues extends ClubFormValues {
  logo_url?: string;
  admin_invites?: AdminInvite[];
}

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
  const { formData, updateFormData, resetWizard } = useClubWizardStore();

  const defaultValues = useMemo<ClubWizardFormValues>(() => ({
    name: formData.name || "",
    slug: formData.slug || "",
    description: formData.description || "",
    visibility: formData.visibility || "public",
    category_id: formData.category_id || null,
    github_repo_url: formData.github_repo_url || "",
    logo_url: formData.logo_url || "",
    social_links: formData.social_links || {},
    admin_invites: formData.admin_invites || [],
    tags: formData.tags || [],
  }), [formData]);

  const form = useForm<ClubWizardFormValues>({
    resolver: zodResolver(clubFormSchema) as any,
    defaultValues,
    mode: "onBlur",
  });

  const nameValue = form.watch("name");

  // Keep Zustand store in sync with form state edits
  useEffect(() => {
    const subscription = form.watch((values) => {
      updateFormData({
        name: values.name || "",
        slug: values.slug || "",
        description: values.description || "",
        visibility: values.visibility || "public",
        category_id: values.category_id || null,
        github_repo_url: values.github_repo_url || "",
        logo_url: values.logo_url || "",
        social_links: (values.social_links as Record<string, string>) || {},
        admin_invites: values.admin_invites || [],
        tags: values.tags || [],
      });
    });
    return () => subscription.unsubscribe();
  }, [form, updateFormData]);

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

      const { data: newClub, error } = await supabase
        .from("clubs")
        .insert({
          name: values.name.trim(),
          slug: values.slug.trim(),
          description: sanitizeHtml(values.description.trim()),
          logo_url: values.logo_url || null,
          category_id: values.category_id || null,
          github_repo_url: values.github_repo_url ?? null,
          social_links: values.social_links ?? {},
          visibility: values.visibility,
          created_by: user.id,
          status: "pending",
          tags: values.tags || [],
        })
        .select()
        .single();

      if (error) throw error;

      // Handle co-organizer / admin invitations if any were added
      if (values.admin_invites && values.admin_invites.length > 0 && newClub) {
        try {
          const inviteRecords = values.admin_invites.map((invite) => ({
            club_id: newClub.id,
            email: invite.email.trim().toLowerCase(),
            role: invite.role,
            invited_by: user.id,
            status: "pending",
          }));
          await supabase.from("club_invitations").insert(inviteRecords);
        } catch {
          // Gracefully continue if invitations table is optional
        }
      }

      sessionStorage.removeItem(STORAGE_KEY);
      resetWizard();
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
        id: "basic-details",
        title: "Basic Details",
        description: "Set the club's name, web address slug, category, and access visibility.",
        fields: ["name", "slug", "category_id"],
        render: () => (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control as any}
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
                control={form.control as any}
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
              control={form.control as any}
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
        id: "mission-logo",
        title: "Mission & Logo",
        description: "Define your club's constitution, GitHub repository, and square logo.",
        fields: ["description"],
        render: () => (
          <div className="space-y-6">
            <FormField
              control={form.control as any}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Club Description & Constitution (Markdown)</FormLabel>
                  <FormControl>
                    <MarkdownEditor
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Write about your club's mission, goals, and constitution..."
                      rows={6}
                      minHeightClass="min-h-40"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <SmartTagSuggester
                      missionText={form.watch("description") || ""}
                      selectedTags={field.value || []}
                      onChange={(tags) =>
                        form.setValue("tags", tags, {
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

            <FormField
              control={form.control as any}
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
              form={form as any}
              name="twitter"
              label="Twitter / X URL"
              placeholder="https://x.com/your-club"
            />
            <SocialLinkField
              form={form as any}
              name="instagram"
              label="Instagram URL"
              placeholder="https://instagram.com/your-club"
            />
            <SocialLinkField
              form={form as any}
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
                          .map((part: string) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      : "CL"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1">
              <p className="eyebrow mb-1 font-bold text-black">Club Logo</p>
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
        id: "invites-socials",
        title: "Admin Invites & Socials",
        description: "Invite co-organizers by email and add social media links.",
        fields: [],
        render: () => (
          <div className="space-y-6">
            <AdminInvitesManager form={form} />

            <div className="border-t-2 border-dashed border-black pt-5 space-y-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                Social Profiles & Website
              </h3>
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
          </div>
        ),
      },
      {
        id: "review-submit",
        title: "Review & Submit",
        description: "Double-check all club details and team invites before submitting.",
        fields: [],
        render: () => <ReviewSummary form={form as any} />,
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
            Four simple steps. Progress is saved automatically to sessionStorage as you type.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <Wizard
              form={form as any}
              steps={steps}
              storageKey={STORAGE_KEY}
              basePath="/clubs/new"
              isSubmitting={isSubmitting}
              submitLabel="Submit Club for Review"
              onSubmitted={handleSubmitted}
            />
          </form>
        </Form>
      </div>
    </SiteShell>
  );
}

function AdminInvitesManager({ form }: { form: ReturnType<typeof useForm<ClubWizardFormValues>> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminInvite["role"]>("vice-president");

  const invites = form.watch("admin_invites") ?? [];

  const handleAddInvite = () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (invites.some((inv) => inv.email === trimmedEmail)) {
      toast.error("This email has already been invited.");
      return;
    }

    const updatedInvites = [...invites, { email: trimmedEmail, role }];
    form.setValue("admin_invites", updatedInvites, { shouldDirty: true });
    setEmail("");
    toast.success(`Added ${trimmedEmail} as ${role}.`);
  };

  const handleRemoveInvite = (index: number) => {
    const updatedInvites = invites.filter((_, i) => i !== index);
    form.setValue("admin_invites", updatedInvites, { shouldDirty: true });
  };

  return (
    <div className="neu-border bg-white p-4 space-y-4">
      <div className="flex items-center gap-2 border-b-2 border-black pb-2">
        <UserCheck className="h-4 w-4 text-black" />
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
          Co-Organizers & Officer Invitations
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="sm:col-span-6">
          <label className="block font-mono text-[10px] font-bold uppercase text-gray-600 mb-1">
            Officer Email
          </label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="co-president@campus.edu"
              className="pl-8"
            />
          </div>
        </div>

        <div className="sm:col-span-4">
          <label className="block font-mono text-[10px] font-bold uppercase text-gray-600 mb-1">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminInvite["role"])}
            className="w-full neu-border bg-white p-2 font-mono text-xs font-bold uppercase text-black"
          >
            <option value="co-president">Co-President</option>
            <option value="vice-president">Vice President</option>
            <option value="treasurer">Treasurer</option>
            <option value="secretary">Secretary</option>
            <option value="officer">Officer</option>
          </select>
        </div>

        <div className="sm:col-span-2 flex items-end">
          <button
            type="button"
            onClick={handleAddInvite}
            className="neu-border neu-press w-full bg-lime py-2 font-mono text-xs font-bold uppercase text-black flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {invites.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="font-mono text-[10px] font-bold uppercase text-gray-500">
            Pending Officer Invites ({invites.length})
          </p>
          <ul className="divide-y divide-gray-200 border border-black bg-gray-50">
            {invites.map((inv, index) => (
              <li
                key={inv.email}
                className="flex items-center justify-between p-2.5 font-mono text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-black">{inv.email}</span>
                  <span className="bg-black text-cream px-1.5 py-0.5 text-[10px] uppercase font-bold">
                    {inv.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveInvite(index)}
                  className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                  title="Remove invitation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="font-mono text-xs text-gray-500 italic">
          No co-organizer invites added yet. You can also add officers after your club is approved.
        </p>
      )}
    </div>
  );
}

function SocialLinkField({
  form,
  name,
  label,
  placeholder,
}: {
  form: UseFormReturn<ClubWizardFormValues, any, undefined>;
  name: string;
  label: string;
  placeholder: string;
}) {
  const links = form.watch("social_links") ?? {};
  const value = links[name] ?? "";

  return (
    <div>
      <label className="block font-mono text-xs font-bold uppercase text-black mb-1">{label}</label>
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

function ReviewSummary({ form }: { form: UseFormReturn<ClubWizardFormValues, any, undefined> }) {
  const values = form.watch();

  const rows = [
    { label: "Club Name", value: values.name },
    { label: "Web Address", value: values.slug ? `/clubs/${values.slug}` : "" },
    { label: "Visibility", value: values.visibility },
    { label: "Description", value: values.description },
    { label: "GitHub Repo", value: values.github_repo_url ?? "" },
    { label: "Search Tags", value: values.tags && values.tags.length > 0 ? values.tags.join(", ") : "" },
  ];

  return (
    <div className="space-y-4">
      <div className="neu-border bg-white p-4 space-y-3">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-black border-b-2 border-black pb-2">
          Club Essentials & Mission
        </h3>
        {rows.map(
          (row) =>
            row.value && (
              <div
                key={row.label}
                className="flex items-start justify-between gap-4 border-b border-dashed border-gray-300 pb-1.5"
              >
                <span className="font-mono text-xs font-bold uppercase text-gray-600 shrink-0">
                  {row.label}
                </span>
                <span className="font-mono text-xs text-black text-right break-all">
                  {row.value}
                </span>
              </div>
            ),
        )}

        {values.logo_url && (
          <div className="flex items-center justify-between gap-4 border-b border-dashed border-gray-300 pb-1.5">
            <span className="font-mono text-xs font-bold uppercase text-gray-600 shrink-0">
              Logo
            </span>
            <img
              src={values.logo_url}
              alt="Club Logo"
              className="h-10 w-10 rounded-full border-2 border-black object-cover"
            />
          </div>
        )}
      </div>

      <div className="neu-border bg-white p-4 space-y-2">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-black border-b-2 border-black pb-2">
          Officer Invitations ({invites.length})
        </h3>
        {invites.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {invites.map((inv) => (
              <span
                key={inv.email}
                className="neu-border bg-lime/30 px-2 py-1 font-mono text-[11px] font-bold text-black flex items-center gap-1.5"
              >
                <span>{inv.email}</span>
                <span className="bg-black text-cream px-1 py-0.2 text-[9px] uppercase font-bold">
                  {inv.role}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-gray-500 italic">No co-organizers invited yet.</p>
        )}
      </div>
    </div>
  );
}
