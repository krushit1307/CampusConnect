import { useNavigate, useBlocker } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SiteShell } from "@/components/site/SiteShell";
import { useEffect, useRef, useState, useId, type ChangeEvent, type KeyboardEvent } from "react";
import { Camera, Loader2, X, Plus, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { announce } from "@/store/ariaAnnouncer";
import { createClient, getSupabaseUrl } from "@/lib/supabase/client";
import { withAuth, WithAuthProps } from "@/hoc/withAuth";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/ThemeToggle";

import { OptimizedImage } from "@/components/media/OptimizedImage";

import type { User } from "@supabase/supabase-js";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "@/components/theme-provider";
import { SecuritySection } from "@/components/Settings/SecuritySection";
import { uploadFileWithProgress } from "@/lib/supabase/uploadFileWithProgress";
import { Progress } from "@/components/ui/progress";
import { useTheme } from "@/components/theme-provider";
import { SecuritySection } from "@/components/Settings/SecuritySection";
import { uploadFileWithProgress } from "@/lib/supabase/uploadFileWithProgress";
import { Progress } from "@/components/ui/progress";
import {
  profileSchema,
  notificationPreferencesSchema,
  AVATAR_THEMES,
  type ProfileFormValues,
  type NotificationPreferencesValues,
  type AvatarThemeId,
} from "@/lib/schemas";
import { BlockedUsersPanel } from "@/components/Settings/BlockedUsersPanel";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { PasskeyManager } from "@/components/PasskeyManager";
import { useTheme } from "@/components/theme-provider";
import { AudioEngine, SOUND_ENABLED_KEY } from "@/lib/audio/audioEngine";

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

function SettingsPageContent({ user }: WithAuthProps) {
  const navigate = useNavigate();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [borderThickness, setBorderThickness] = useState(2);
  const [borderRadius, setBorderRadius] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
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

  const handleDeleteAccount = async () => {
    if (!user) {
      setDeleteError("User session not found.");
      return;
    }
    if (!deletePassword.trim()) {
      setDeleteError("Password is required.");
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email || "",
        password: deletePassword,
      });

      if (authError) {
        setDeleteError(authError.message || "Incorrect password. Please try again.");
        setIsDeleting(false);
        return;
      }

      // Credentials verified successfully. Continue with existing deletion flow.
      setConfirmOpen(false);
      setDeletePassword("");
      toast.success("Account deleted successfully.");
    } catch (err: any) {
      setDeleteError(err.message || "An unexpected error occurred during verification.");
    } finally {
      setIsDeleting(false);
    }
  };
  useEffect(() => {
    // Load appearance settings from localStorage
    const savedThickness = localStorage.getItem("border-thickness");
    const savedRadius = localStorage.getItem("border-radius");
    setSoundEnabled(localStorage.getItem(SOUND_ENABLED_KEY) === "true");

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

  const {
    data: preferences,
    isLoading: isPreferencesLoading,
  } = useQuery({
    queryKey: ["user_preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user?.id)
        .single();
      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows found
      return data;
    },
    enabled: !!user?.id,
  });

  const form = useForm<ProfileFormValues & NotificationPreferencesValues>({
    resolver: zodResolver(profileSchema.merge(notificationPreferencesSchema)),
    defaultValues: {
      avatarTheme: "",
      firstName: "",
      lastName: "",
      handle: "",
      collegeEmail: "",
      bio: "",
      linkedinUrl: "",
      phoneNumber: "",
      email_alerts: true,
      push_notifications: true,
      digest: true,
      dark_mode_default: false,
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
        email_alerts: preferences?.email_alerts ?? true,
        push_notifications: preferences?.push_notifications ?? true,
        digest: preferences?.digest ?? true,
        dark_mode_default: preferences?.dark_mode_default ?? false,
      });
      // Hydrate skills from profile (text[])
      if (Array.isArray(profile?.skills)) {
        setSkills(profile.skills as string[]);
      }
    }
  }, [profile, preferences, user, form]);

  const onSubmit = async (values: ProfileFormValues & NotificationPreferencesValues) => {
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

      // Update user_preferences table
      const { error: prefError } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          email_alerts: values.email_alerts,
          push_notifications: values.push_notifications,
          digest: values.digest,
          dark_mode_default: values.dark_mode_default,
        });
      if (prefError) throw prefError;

      // Update email if it has changed
      if (values.collegeEmail !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: values.collegeEmail,
        });
        if (authError) throw authError;
        toast.success("Profile updated! Verification email sent to your new address.");
        announce("Profile updated! Verification email sent to your new address.");
      } else {
        toast.success("Profile updated successfully!");
        announce("Profile updated successfully");
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

  const handleSoundEnabledChange = (enabled: boolean) => {
    setSoundEnabled(enabled);
    AudioEngine.setEnabled(enabled);
    if (enabled) AudioEngine.playToggle();
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
                    control={form.control as any}
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
                    control={form.control as any}
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
                  control={form.control as any}
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
                  control={form.control as any}
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
                  control={form.control as any}
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
                  control={form.control as any}
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
                  control={form.control as any}
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
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`neu-border neu-press px-4 py-2 font-mono text-xs font-bold uppercase ${
                      theme === "light"
                        ? "bg-black text-cream dark:bg-cream dark:text-black"
                        : "bg-white text-black hover:bg-lime dark:bg-brand-gray-base-800 dark:text-cream"
                    }`}
                  >
                    ☀️ Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`neu-border neu-press px-4 py-2 font-mono text-xs font-bold uppercase ${
                      theme === "dark"
                        ? "bg-black text-cream dark:bg-cream dark:text-black"
                        : "bg-white text-black hover:bg-lime dark:bg-brand-gray-base-800 dark:text-cream"
                    }`}
                  >
                    🌙 Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`neu-border neu-press px-4 py-2 font-mono text-xs font-bold uppercase ${
                      theme === "system"
                        ? "bg-black text-cream dark:bg-cream dark:text-black"
                        : "bg-white text-black hover:bg-lime dark:bg-brand-gray-base-800 dark:text-cream"
                    }`}
                  >
                    💻 System
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("high-contrast")}
                    className={`neu-border neu-press px-4 py-2 font-mono text-xs font-bold uppercase ${
                      theme === "high-contrast"
                        ? "bg-black text-cream dark:bg-cream dark:text-black"
                        : "bg-white text-black hover:bg-lime dark:bg-brand-gray-base-800 dark:text-cream"
                    }`}
                  >
                    ⬛ High Contrast
                  </button>
                </div>
              </div>

              <FormField
              control={form.control as any}
              name="dark_mode_default"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="flex items-center justify-between gap-4 border-t-2 border-black pt-4">
                      <div>
                        <label htmlFor={field.id} className="eyebrow font-bold text-black dark:text-cream">
                          Dark Mode by Default
                        </label>
                        <p className="font-mono text-xs text-muted-foreground">
                          When enabled, the app will default to dark mode on each visit unless you manually switch themes.
                        </p>
                      </div>
                      <input
                        {...field}
                        type="checkbox"
                        className="h-5 w-5 accent-black"
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            </FormField>

            <div className="flex items-center justify-between gap-4 border-t-2 border-black pt-4">
              <label
                htmlFor="ui-sounds"
                className="eyebrow font-bold text-black dark:text-cream"
              >
                UI Sounds
              </label>
              <p className="font-mono text-xs text-muted-foreground">
                Play subtle synthesized clicks, toggles, and like pops.
              </p>
              <input
                id="ui-sounds"
                type="checkbox"
                checked={soundEnabled}
                onChange={(event) => handleSoundEnabledChange(event.target.checked)}
                className="h-5 w-5 accent-black"
              />
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

          <Panel title="Blocked Users">
            <BlockedUsersPanel currentUserId={user.id} />
          </Panel>

          <Panel title="Passkeys">
            <PasskeyManager />
          </Panel>

          <Panel title="Notifications">
            <FormField
              control={form.control as any}
              name="email_alerts"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="flex cursor-pointer items-center justify-between gap-3">
                      <label htmlFor={field.id} className="font-mono text-sm">
                        Email me about upcoming RSVPs
                      </label>
                      <input
                        {...field}
                        type="checkbox"
                        className="h-5 w-5 accent-black"
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            </FormField>
            <FormField
              control={form.control as any}
              name="digest"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="flex cursor-pointer items-center justify-between gap-3">
                      <label htmlFor={field.id} className="font-mono text-sm">
                        Weekly digest of club activity
                      </label>
                      <input
                        {...field}
                        type="checkbox"
                        className="h-5 w-5 accent-black"
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            </FormField>
            <FormField
              control={form.control as any}
              name="push_notifications"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="flex cursor-pointer items-center justify-between gap-3">
                      <label htmlFor={field.id} className="font-mono text-sm">
                        New certificates
                      </label>
                      <input
                        {...field}
                        type="checkbox"
                        className="h-5 w-5 accent-black"
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            </FormField>
          </Panel>

          <Panel title="Danger zone" tone="bg-red-50">
            <button
              onClick={() => setConfirmOpen(true)}
              className="neu-border neu-press bg-brand-blue-dark px-4 py-2 font-mono text-xs font-bold uppercase text-white"
            >
              Delete account
            </button>

            <Dialog
              open={confirmOpen}
              onOpenChange={(isOpen) => {
                if (!isOpen && !isDeleting) {
                  setConfirmOpen(false);
                  setDeletePassword("");
                  setDeleteError("");
                }
              }}
            >
              <DialogContent className="border-2 border-black bg-white p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl font-extrabold tracking-tight text-black">
                    Delete account?
                  </DialogTitle>
                  <DialogDescription className="font-mono text-xs text-gray-600 mt-2">
                    This action cannot be undone. Please enter your password to confirm deletion.
                  </DialogDescription>
                </DialogHeader>

                <div className="my-4 space-y-2">
                  <label className="block font-mono text-xs font-bold uppercase text-black">
                    Current Password
                  </label>
                  <PasswordInput
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={isDeleting}
                    className="w-full border-2 border-black bg-white p-2 font-mono text-xs outline-none"
                  />
                  {deleteError && (
                    <p className="font-mono text-xs text-red-600 font-bold">{deleteError}</p>
                  )}
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-black/10">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      setConfirmOpen(false);
                      setDeletePassword("");
                      setDeleteError("");
                    }}
                    className="neu-border neu-press bg-white text-black hover:bg-cream px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteAccount}
                    className="neu-border neu-press bg-brand-blue-dark hover:bg-brand-blue-dark/90 px-4 py-2 font-mono text-xs font-bold uppercase text-white disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDeleting && <Loader2 className="h-3 w-3 animate-spin text-white" />}
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Panel>
        </div>
      </section>
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
      <p className="eyebrow font-bold" id="avatar-theme-label">
        Avatar theme
      </p>
      <p className="font-mono text-xs text-gray-500 dark:text-gray-300">
        Pick a gradient background to use when you don&apos;t have a custom photo.
      </p>
      <div
        className="flex flex-wrap gap-3 pt-1"
        role="radiogroup"
        aria-labelledby="avatar-theme-label"
      >
        {AVATAR_THEMES.map((theme) => {
          const isSelected = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelect(theme.id)}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${theme.label} gradient`}
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragging(true);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUpload(file);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleUpload(file);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Only JPG, PNG and WEBP images are allowed.");
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setUploadProgress(0);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const supabaseUrl = getSupabaseUrl();
      await uploadFileWithProgress(
        supabaseUrl,
        session.access_token,
        "avatars",
        filePath,
        file,
        setUploadProgress,
      );

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      await handleUploaded(publicUrl);
      toast.success("Profile picture updated.");
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Failed to upload image.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

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
          role="img"
          aria-label={`${name}'s avatar profile picture`}
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

        {/* Neubrutalist drag-and-drop zone — replaces the raw <input type="file"> trigger */}
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !uploading) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Upload profile picture. Click to browse, or drag and drop an image."
          className={`neu-border flex cursor-pointer flex-col items-center justify-center gap-1.5 border-2 border-dashed p-5 text-center transition-colors duration-150 ${
            uploading
              ? "cursor-not-allowed border-black bg-gray-100 opacity-70"
              : isDragging
                ? "border-black bg-lime/40 scale-[1.01]"
                : "border-black bg-white hover:bg-cream"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : (
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          )}
          <p className="font-mono text-xs font-bold uppercase">
            {uploading
              ? "Uploading..."
              : isDragging
                ? "Drop to upload"
                : "Drag & drop or click to upload"}
          </p>
          <p className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
            JPG, PNG or WEBP · Max 2 MB · Square images look best
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Selected file name + size preview */}
        {selectedFile && (
          <div className="neu-border flex items-center justify-between gap-3 bg-white px-3 py-2 font-mono text-xs">
            <span className="flex items-center gap-2 truncate">
              <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate" title={selectedFile.name}>
                {selectedFile.name}
              </span>
            </span>
            <span className="shrink-0 font-bold text-gray-600 dark:text-gray-300">
              {formatFileSize(selectedFile.size)}
            </span>
          </div>
        )}

        {uploadProgress !== null && (
          <div className="w-full space-y-1">
            <Progress value={uploadProgress} className="h-2" />
            <p className="font-mono text-xs text-gray-500 dark:text-gray-300">{uploadProgress}%</p>
          </div>
        )}
      </div>
      <div className="text-center sm:text-left">
        <p className="eyebrow font-bold text-black">Profile picture</p>
        <p className="font-mono text-xs text-gray-500 dark:text-gray-300">
          JPG, PNG or WEBP. Max 2 MB. Square images look best.
        </p>
      </div>
    </div>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const id = useId();
  return (
    <div className="flex cursor-pointer items-center justify-between gap-3">
      <label htmlFor={id} className="font-mono text-sm">
        {label}
      </label>
      <input
        id={id}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-5 w-5 accent-black"
      />
    </div>
  );
}

export default withAuth(SettingsPageContent);
