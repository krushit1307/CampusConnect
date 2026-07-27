import { useNavigate, useBlocker } from "react-router-dom";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SiteShell } from "@/components/site/SiteShell";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useTheme } from "@/components/theme-provider";
import { Loader2, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SecuritySection } from "@/components/Settings/SecuritySection";

import { OptimizedImage } from "@/components/media/OptimizedImage";

import type { User } from "@supabase/supabase-js";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileSchema,
  AVATAR_THEMES,
  type ProfileFormValues,
  type AvatarThemeId,
} from "@/lib/schemas";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { ImageCropUpload } from "@/components/ImageCropUpload";

const FONT_SIZE_KEY = "campusconnect-font-size";

// Apply persisted font size immediately on module load
const _initFontSize = localStorage.getItem(FONT_SIZE_KEY);
if (_initFontSize) {
  document.documentElement.style.setProperty("--font-size-base", `${_initFontSize}px`);
  document.documentElement.style.fontSize = `${_initFontSize}px`;
}
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_DEFAULT = 16;
const FONT_SIZE_STEP = 1;

function useFontSize() {
  const [fontSize, setFontSizeState] = useState<number>(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    return stored ? parseInt(stored, 10) : FONT_SIZE_DEFAULT;
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", `${fontSize}px`);
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  const increment = () => setFontSizeState((s) => Math.min(s + FONT_SIZE_STEP, FONT_SIZE_MAX));
  const decrement = () => setFontSizeState((s) => Math.max(s - FONT_SIZE_STEP, FONT_SIZE_MIN));
  const reset = () => setFontSizeState(FONT_SIZE_DEFAULT);

  return { fontSize, increment, decrement, reset };
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [borderThickness, setBorderThickness] = useState(2);
  const [borderRadius, setBorderRadius] = useState(0);
  const { fontSize, increment, decrement, reset } = useFontSize();

  // --- Skills tags state ---
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const skillInputRef = useRef<HTMLInputElement>(null);

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput("");
    skillInputRef.current?.focus();
  };

  const handleSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate("/auth", { replace: true });
      } else {
        setUser(user);
      }
    });

    // Load appearance settings from localStorage
    const savedThickness = localStorage.getItem("border-thickness");
    const savedRadius = localStorage.getItem("border-radius");

    if (savedThickness) {
      const thickness = parseInt(savedThickness, 10);
      setBorderThickness(thickness);
      document.documentElement.style.setProperty("--border-thickness", `${thickness}px`);
    }

    if (savedRadius) {
      const radius = parseInt(savedRadius, 10);
      setBorderRadius(radius);
      document.documentElement.style.setProperty("--border-radius", `${radius}px`);
    }
  }, [navigate, supabase]);

  const {
    data: profile,
    isLoading: isProfileLoading,
    refetch,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      avatarTheme: "",
      firstName: "",
      lastName: "",
      handle: "",
      collegeEmail: "",
      bio: "",
      linkedinUrl: "",
      phoneNumber: "",
    },
  });
  const {
    formState: { isDirty },
  } = form;
  const blocker = useBlocker(isDirty);
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);
  useEffect(() => {
    if (blocker.state !== "blocked") return;

    const shouldLeave = window.confirm("You have unsaved changes. Are you sure you want to leave?");

    if (shouldLeave) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    if (user) {
      // Auth metadata (from OAuth sign-up, etc.) may only ever have a single
      // full_name string. If the profile row hasn't been saved with split
      // first/last names yet, fall back to a best-effort split of that.
      const [metaFirstName = "", ...metaRest] = (user.user_metadata?.full_name || "").split(" ");
      const metaLastName = metaRest.join(" ");

      form.reset({
        avatarTheme: (profile?.avatar_theme as AvatarThemeId) || "",
        firstName: profile?.first_name || metaFirstName,
        lastName: profile?.last_name || metaLastName,
        handle: profile?.handle || "",
        collegeEmail: user.email || "",
        bio: profile?.bio || "",
        linkedinUrl: profile?.linkedin_url || "",
        phoneNumber: profile?.phone_number || "",
      });
      // Hydrate skills from profile (text[])
      if (Array.isArray(profile?.skills)) {
        setSkills(profile.skills as string[]);
      }
    }
  }, [profile, user, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    setIsSaving(true);
    try {
      if (!user) {
        toast.error("You must be logged in to update your profile.");
        return;
      }

      // Update profiles table (including skills text[])
      const dedupedSkills = [...new Set(skills.map((s) => s.trim()).filter(Boolean))];
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_theme: values.avatarTheme || null,
          first_name: values.firstName,
          last_name: values.lastName,
          handle: values.handle,
          bio: values.bio || null,
          linkedin_url: values.linkedinUrl || null,
          phone_number: values.phoneNumber || null,
          skills: dedupedSkills,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update email if it has changed
      if (values.collegeEmail !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: values.collegeEmail,
        });
        if (authError) throw authError;
        toast.success("Profile updated! Verification email sent to your new address.");
      } else {
        toast.success("Profile updated successfully!");
      }

      refetch();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentFirstName = form.watch("firstName");
  const currentLastName = form.watch("lastName");
  const currentFullName = `${currentFirstName} ${currentLastName}`.trim();
  const currentAvatarTheme = form.watch("avatarTheme");

  const handleBorderThicknessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setBorderThickness(value);
    document.documentElement.style.setProperty("--border-thickness", `${value}px`);
    localStorage.setItem("border-thickness", String(value));
  };

  const handleBorderRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setBorderRadius(value);
    document.documentElement.style.setProperty("--border-radius", `${value}px`);
    localStorage.setItem("border-radius", String(value));
  };

  interface ProfileStats {
    lastActivityAt?: string;
    welcomeSource?: string;
    processedClaimCommentIds?: number[];
  }
  const pStats = profile as typeof profile & ProfileStats;

  if (isProfileLoading && !profile) {
    return (
      <SiteShell>
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-[#0bc5ea] px-4 py-16 md:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-sm font-bold uppercase tracking-widest text-black/80">
            Account
          </p>
          <h1 className="mt-2 text-5xl font-extrabold tracking-tight text-black md:text-7xl">
            Settings.
          </h1>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* --- NEW COLORFUL STATS GRID --- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="border-2 border-black bg-[#a3e635] p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
              <p className="font-mono text-xs font-bold uppercase text-black/70">Last Active</p>
              <p className="mt-2 font-display text-xl font-bold text-black">
                {pStats?.lastActivityAt
                  ? new Date(pStats.lastActivityAt).toLocaleDateString()
                  : "Just now"}
              </p>
            </div>

            <div className="border-2 border-black bg-[#fb923c] p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
              <p className="font-mono text-xs font-bold uppercase text-black/70">Welcome Status</p>
              <p className="mt-2 font-display text-xl font-bold text-black">
                {pStats?.welcomeSource ? `Via ${pStats.welcomeSource}` : "Pending"}
              </p>
            </div>

            <div className="border-2 border-black bg-[#22d3ee] p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
              <p className="font-mono text-xs font-bold uppercase text-black/70">
                Claims Processed
              </p>
              <p className="mt-2 font-display text-xl font-bold text-black">
                {pStats?.processedClaimCommentIds?.length || 0}
              </p>
            </div>
          </div>
          {/* ------------------------------- */}
          <Panel title="Profile">
            <AvatarUpload name={currentFullName || "User"} avatarTheme={currentAvatarTheme} />

            <AvatarThemePicker
              selected={currentAvatarTheme}
              onSelect={(id) => form.setValue("avatarTheme", id, { shouldDirty: true })}
            />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel required className="eyebrow font-bold text-black">
                          First name
                        </FormLabel>
                        <FormControl>
                          <input
                            {...field}
                            className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                          />
                        </FormControl>
                        <FormMessage className="font-mono text-xs text-destructive" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel required className="eyebrow font-bold text-black">
                          Last name
                        </FormLabel>
                        <FormControl>
                          <input
                            {...field}
                            className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                          />
                        </FormControl>
                        <FormMessage className="font-mono text-xs text-destructive" />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="handle"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel required className="eyebrow font-bold text-black">
                        Handle
                      </FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          placeholder="username"
                          className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="collegeEmail"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel required className="eyebrow font-bold text-black">
                        College email
                      </FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          type="email"
                          className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="eyebrow font-bold text-black">Phone number</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          placeholder="+1 (555) 000-0000"
                          className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="eyebrow font-bold text-black">LinkedIn URL</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          placeholder="https://linkedin.com/in/username"
                          className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="eyebrow font-bold text-black">Bio</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs text-destructive" />
                    </FormItem>
                  )}
                />

                {/* ── Skills Tags Editor ── */}
                <div className="space-y-2 pt-2">
                  <p className="eyebrow font-bold text-black">Skills</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Add skills to power matchmaking — press Enter or click{" "}
                    <span className="font-bold">+</span> to add.
                  </p>

                  {/* Existing skill chips */}
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="neu-border inline-flex items-center gap-1 bg-lime px-2.5 py-1 font-mono text-xs font-bold"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skill)}
                            aria-label={`Remove skill ${skill}`}
                            className="ml-0.5 rounded-none transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                          >
                            <X className="h-3 w-3" strokeWidth={2.5} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Add skill input row */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={skillInputRef}
                      value={skillInput}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSkillInput(e.target.value)}
                      onKeyDown={handleSkillKeyDown}
                      placeholder="e.g. React, Python, UI Design…"
                      className="flex-1 border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      aria-label="Add skill"
                      className="neu-border bg-black p-2 text-cream transition-all hover:scale-105 active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={isSaving || isProfileLoading}
                    className="neu-border neu-press flex items-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </button>
                </div>
              </form>
            </Form>
          </Panel>

          <Panel title="Appearance">
            <div className="space-y-6">
              {/* Theme Toggle */}
              <div className="space-y-2">
                <label className="eyebrow font-bold text-black dark:text-cream">Theme Mode</label>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="eyebrow font-bold text-black dark:text-cream">
                      Dark Mode
                    </label>

                    <p className="font-mono text-xs text-muted-foreground">
                      Toggle between light and dark theme
                    </p>
                  </div>

                  <ThemeToggle theme={theme} setTheme={setTheme} />
                </div>
              </div>

              {/* Border Thickness */}
              <div className="space-y-2">
                <label className="eyebrow font-bold">Border Thickness: {borderThickness}px</label>

                <input
                  type="range"
                  min="1"
                  max="8"
                  value={borderThickness}
                  onChange={handleBorderThicknessChange}
                  className="w-full cursor-pointer accent-black"
                />

                <p className="font-mono text-xs text-muted-foreground">
                  Controls the width of borders throughout the app (1px - 8px)
                </p>
              </div>

              {/* Border Radius */}
              <div className="space-y-2">
                <label className="eyebrow font-bold">Border Radius: {borderRadius}px</label>

                <input
                  type="range"
                  min="0"
                  max="32"
                  value={borderRadius}
                  onChange={handleBorderRadiusChange}
                  className="w-full cursor-pointer accent-black"
                />

                <p className="font-mono text-xs text-muted-foreground">
                  Controls the roundness of corners (0px - 32px)
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Text Size">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={decrement}
                aria-label="Decrease font size"
                className="neu-border neu-press flex h-9 w-9 items-center justify-center bg-white font-mono text-lg font-bold"
              >
                −
              </button>
              <span className="font-mono text-sm font-bold text-black">{fontSize}px</span>
              <button
                type="button"
                onClick={increment}
                aria-label="Increase font size"
                className="neu-border neu-press flex h-9 w-9 items-center justify-center bg-white font-mono text-lg font-bold"
              >
                +
              </button>
              <button
                type="button"
                onClick={reset}
                className="neu-border neu-press px-3 py-1 font-mono text-xs font-bold uppercase text-black"
              >
                Reset
              </button>
            </div>
          </Panel>

          <Panel title="Notifications">
            <Toggle label="Email me about upcoming RSVPs" defaultChecked />
            <Toggle label="Weekly digest of club activity" defaultChecked />
            <Toggle label="New certificates" />
          </Panel>

          <Panel title="Danger zone" tone="bg-red-50">
            <button
              onClick={() => setConfirmOpen(true)}
              className="neu-border neu-press bg-brand-blue-dark px-4 py-2 font-mono text-xs font-bold uppercase text-white"
            >
              Delete account
            </button>

            <ConfirmModal
              open={confirmOpen}
              title="Delete account?"
              description="This action cannot be undone."
              confirmText="Delete"
              cancelText="Cancel"
              onCancel={() => setConfirmOpen(false)}
              onConfirm={() => {
                setConfirmOpen(false);
              }}
            />
          </Panel>
        </div>
      </section>
      <SecuritySection />
    </SiteShell>
  );
}

function Panel({
  title,
  tone = "bg-white",
  children,
}: {
  title: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`border-2 border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] ${tone} p-6 md:p-8`}
    >
      <h2 className="mb-6 border-b-2 border-black pb-3 font-display text-2xl font-extrabold tracking-tight text-black">
        {title}
      </h2>
      <div className="space-y-6 text-black">{children}</div>
    </section>
  );
}

// Renders the 5 predefined gradient swatches. Clicking one updates the form
// state immediately (so AvatarUpload's preview reflects it right away), and
// the value is persisted to Supabase along with the rest of the profile
// fields when the user hits "Save changes".
function AvatarThemePicker({
  selected,
  onSelect,
}: {
  selected?: AvatarThemeId | "";
  onSelect: (id: AvatarThemeId) => void;
}) {
  return (
    <div className="space-y-2 border-b-2 border-black pb-6">
      <p className="eyebrow font-bold">Avatar theme</p>
      <p className="font-mono text-xs text-muted-foreground">
        Pick a gradient background to use when you don&apos;t have a custom photo.
      </p>
      <div className="flex flex-wrap gap-3 pt-1">
        {AVATAR_THEMES.map((theme) => {
          const isSelected = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelect(theme.id)}
              aria-label={`${theme.label} gradient`}
              aria-pressed={isSelected}
              title={theme.label}
              className={`h-10 w-10 rounded-full border-2 border-black transition-transform ${theme.gradient} ${
                isSelected
                  ? "scale-110 ring-4 ring-black ring-offset-2 ring-offset-white"
                  : "hover:scale-105"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

function AvatarUpload({ name, avatarTheme }: { name: string; avatarTheme?: AvatarThemeId | "" }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [initials, setInitials] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadAvatar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();

      if (isMounted && !error && data?.avatar_url) {
        setPreview(data.avatar_url);
        setImageError(false);
      }
    }

    loadAvatar();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (name) {
      setInitials(
        name
          .split(" ")
          .filter(Boolean)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      );
    }
  }, [name]);

  const showGradient = (!preview || imageError) && !!avatarTheme;
  const gradientClass = AVATAR_THEMES.find((theme) => theme.id === avatarTheme)?.gradient;
  const backgroundClass = showGradient && gradientClass ? gradientClass : "bg-lime";

  async function handleUploaded(url: string) {
    setPreview(url);
    setImageError(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);

    if (updateError) {
      console.error(updateError);
      toast.error("Failed to save profile picture.");
    }
  }

  return (
    <div className="flex flex-col gap-4 border-b-2 border-black pb-6 sm:flex-row sm:items-start">
      <div className="relative mx-auto shrink-0 sm:mx-0">
        <div
          className={`neu-border flex h-24 w-24 items-center justify-center overflow-hidden rounded-full ${backgroundClass}`}
        >
          {preview && !imageError ? (
            <OptimizedImage
              src={preview}
              alt="Profile picture preview"
              className="h-full w-full object-cover"
              width={96}
              height={96}
              quality={80}
              responsiveWidths={[96, 192]}
              sizes="96px"
              onError={() => setImageError(true)}
              fallback={<span className="font-display text-2xl font-bold">{initials}</span>}
            />
          ) : (
            <span className="font-display text-2xl font-bold text-black">{initials}</span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2">
        <div>
          <p className="eyebrow font-bold text-black">Profile picture</p>
        </div>

        <ImageCropUpload
          aspect={1}
          bucket="avatars"
          value={preview ?? undefined}
          onUploaded={handleUploaded}
          accept="image/jpeg,image/png,image/webp"
          maxSizeBytes={2 * 1024 * 1024}
          label="profile picture"
          hint="JPG, PNG or WEBP · Max 2 MB · Square images look best"
        />
      </div>
    </div>
  );
}
function ThemeToggle({
  theme,
  setTheme,
}: {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
}) {
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const handleToggle = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  return (
    <Switch
      checked={isDark}
      onCheckedChange={handleToggle}
      aria-label="Toggle dark mode"
      className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-200 h-7 w-14 [&>span]:h-5 [&>span]:w-5 data-[state=checked]:[&>span]:translate-x-7 data-[state=unchecked]:[&>span]:translate-x-1 border-2 border-black"
    />
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="font-mono text-sm">{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} className="h-5 w-5 accent-black" />
    </label>
  );
}
