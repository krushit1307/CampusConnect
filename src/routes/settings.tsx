import { useNavigate, useBlocker } from "react-router-dom";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DeleteAccountModal } from "@/components/DeleteAccountModal";
import { SiteShell } from "@/components/site/SiteShell";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import Camera from "lucide-react/dist/esm/icons/camera";
import Check from "lucide-react/dist/esm/icons/check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import X from "lucide-react/dist/esm/icons/x";
import Plus from "lucide-react/dist/esm/icons/plus";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

import { OptimizedImage } from "@/components/media/OptimizedImage";
import { Switch } from "@/components/ui/switch";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

import type { User } from "@supabase/supabase-js";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileSchema,
  ProfileUpdateAllowlistSchema,
  normalizeProfileHandle,
  PROFILE_HANDLE_PATTERN,
  HANDLE_UNAVAILABLE_MESSAGE,
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
import { AutoTaggingSettings } from "@/components/AutoTaggingSettings";
import { useTheme } from "@/components/theme-provider";

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

type HandleAvailability = "idle" | "checking" | "available" | "taken" | "error";

const HANDLE_CHECK_DEBOUNCE_MS = 500;

function isHandleLocallyValid(handle: string) {
  const normalized = normalizeProfileHandle(handle);

  return normalized.length >= 2 && PROFILE_HANDLE_PATTERN.test(normalized);
}

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
  const [handleAvailability, setHandleAvailability] = useState<HandleAvailability>("idle");
  const [personalEmail, setPersonalEmail] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [handleFeedback, setHandleFeedback] = useState<string | null>(null);
  const handleCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [borderThickness, setBorderThickness] = useState(4);
  const [borderRadius, setBorderRadius] = useState(8);
  const [isThemeDrawerOpen, setIsThemeDrawerOpen] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const { fontSize, increment, decrement, reset } = useFontSize();

  // --- Skills tags state ---
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const skillInputRef = useRef<HTMLInputElement>(null);
  const [courseCodes, setCourseCodes] = useState<string[]>([]);
  const [courseCodeInput, setCourseCodeInput] = useState("");
  const courseCodeInputRef = useRef<HTMLInputElement>(null);

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput("");
    skillInputRef.current?.focus();
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleAddCourseCode = () => {
    const normalized = courseCodeInput.trim().replace(/\s+/g, " ").toUpperCase();
    if (normalized && !courseCodes.includes(normalized))
      setCourseCodes((prev) => [...prev, normalized]);
    setCourseCodeInput("");
    courseCodeInputRef.current?.focus();
  };

  const handleCourseCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCourseCode();
    }
  };

  const handleRemoveCourseCode = (courseCode: string) => {
    setCourseCodes((prev) => prev.filter((code) => code !== courseCode));
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      console.log("SETTINGS_GET_USER_RESOLVED:", user);
      if (!user) {
        navigate("/auth", { replace: true });
      } else {
        setUser(user);
      }
    });
  }, []);
  useEffect(() => {
    // Load appearance settings from localStorage
    const savedThickness = localStorage.getItem("theme-border-thickness");
    const savedRadius = localStorage.getItem("theme-border-radius");

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

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user?.id)
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.error("PROFILE_QUERY_ERROR:", err);
        throw err;
      }
    },
    enabled: !!user?.id,
  });

  const [birthDate, setBirthDate] = useState("");
  const [shareBirthday, setShareBirthday] = useState(false);

  const { data: privateDetails, refetch: refetchPrivateDetails } = useQuery({
    queryKey: ["user_private_details", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_private_details")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const profile = profileQuery.data;
  const isProfileLoading = profileQuery.isLoading;
  const refetch = profileQuery.refetch;

  const { data: userPrefs, refetch: refetchPrefs } = useQuery({
    queryKey: ["user_preferences", user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user?.id)
          .maybeSingle();
        if (error) throw error;
        return data;
      } catch (err) {
        console.error("PREFS_QUERY_ERROR:", err);
        throw err;
      }
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (privateDetails) {
      setBirthDate(privateDetails.birth_date || "");
      setShareBirthday(privateDetails.share_birthday || false);
    }
  }, [privateDetails]);

  useEffect(() => {
    if (userPrefs) {
      setTimezone(userPrefs.timezone || "UTC");
      const start = userPrefs.dnd_start_time || userPrefs.quiet_hours_start;
      const end = userPrefs.dnd_end_time || userPrefs.quiet_hours_end;
      if (start) {
        setQuietHoursStart(start.substring(0, 5));
      }
      if (end) {
        setQuietHoursEnd(end.substring(0, 5));
      }
    }
  }, [userPrefs]);

  const handleSavePrefs = async () => {
    if (!user) return;
    setIsSavingPrefs(true);
    try {
      const formattedStart = quietHoursStart ? `${quietHoursStart}:00` : null;
      const formattedEnd = quietHoursEnd ? `${quietHoursEnd}:00` : null;
      const { error } = await supabase.from("user_preferences").upsert({
        user_id: user.id,
        timezone,
        dnd_start_time: formattedStart,
        dnd_end_time: formattedEnd,
        quiet_hours_start: formattedStart,
        quiet_hours_end: formattedEnd,
      });

      if (error) throw error;
      toast.success("Notification preferences saved successfully.");
      refetchPrefs();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save preferences.");
    } finally {
      setIsSavingPrefs(false);
    }
  };

  interface UserBadge {
    id: string;
    user_id: string;
    badge_name: string;
    awarded_at: string;
  }

  const { data: badges = [] } = useQuery({
    queryKey: ["user_badges", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("*")
        .eq("user_id", user?.id);
      if (error) throw error;
      return (data || []) as UserBadge[];
    },
    enabled: !!user?.id,
  });

  const handleAlumniTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !personalEmail.trim()) return;
    setIsTransitioning(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        email: personalEmail.trim(),
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          role: "alumni",
          alumni_transitioned_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast.success(
        "Alumni transition initiated! A confirmation link has been sent to your new email. Please confirm it to complete the authentication change.",
      );
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate alumni transition.");
    } finally {
      setIsTransitioning(false);
    }
  };

  const [isWalletDownloading, setIsWalletDownloading] = useState(false);

  const handleAddToAppleWallet = async () => {
    if (!user) return;
    setIsWalletDownloading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(
        `${getSupabaseUrl()}/functions/v1/generate-wallet-pass?type=apple&passType=id`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate Apple Wallet pass");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "id-card.pkpass";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Wallet pass downloaded successfully!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to download Wallet pass");
    } finally {
      setIsWalletDownloading(false);
    }
  };

  const handleAddToGoogleWallet = async () => {
    if (!user) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(
        `${getSupabaseUrl()}/functions/v1/generate-wallet-pass?type=google&passType=id`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        },
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate Google Wallet pass");
      }

      const data = await response.json();
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Google Wallet link opened!");
      } else {
        throw new Error("No URL returned");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to generate Google Wallet pass");
    }
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as any,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      avatarTheme: "",
      firstName: "",
      lastName: "",
      handle: "",
      collegeEmail: "",
      bio: "",
      linkedinUrl: "",
      phoneNumber: "",
      role: "student",
      expectedGraduationDate: "",
      preferredCurrency: "USD",
    },
  });
  const {
    formState: { isDirty, isValid, errors },
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
    return () => clearPendingHandleCheck();
  }, []);

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
        role: (profile?.role as any) || "student",
        expectedGraduationDate: profile?.expected_graduation_date || "",
        preferredCurrency: profile?.preferred_currency || "USD",
      });
      // Hydrate skills from profile (text[])
      if (Array.isArray(profile?.skills)) {
        setSkills(profile.skills as string[]);
      }
      if (Array.isArray(profile?.course_codes)) {
        setCourseCodes(
          (profile.course_codes as string[]).map((courseCode) => courseCode.toUpperCase()),
        );
      }
    }
  }, [profile, user, form]);

  const clearPendingHandleCheck = () => {
    if (handleCheckTimeoutRef.current) {
      clearTimeout(handleCheckTimeoutRef.current);
      handleCheckTimeoutRef.current = null;
    }
  };

  const validateHandleAvailability = async (rawHandle: string) => {
    const handle = normalizeProfileHandle(rawHandle);

    clearPendingHandleCheck();

    if (!isHandleLocallyValid(handle)) {
      setHandleAvailability("idle");
      setHandleFeedback(null);
      return false;
    }

    if (!user?.id) {
      setHandleAvailability("idle");
      setHandleFeedback(null);
      return false;
    }

    if (profile?.handle && handle.toLowerCase() === String(profile.handle).toLowerCase()) {
      setHandleAvailability("available");
      setHandleFeedback("This handle is available");
      form.clearErrors("handle");
      return true;
    }

    setHandleAvailability("checking");
    setHandleFeedback("Checking handle availability...");

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", handle)
      .neq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      setHandleAvailability("error");
      setHandleFeedback("Unable to verify handle right now. Please try again.");
      form.setError("handle", {
        type: "validate",
        message: "Unable to verify handle right now. Please try again.",
      });
      return false;
    }

    if (data?.id) {
      setHandleAvailability("taken");
      setHandleFeedback(HANDLE_UNAVAILABLE_MESSAGE);
      form.setError("handle", {
        type: "validate",
        message: HANDLE_UNAVAILABLE_MESSAGE,
      });
      return false;
    }

    setHandleAvailability("available");
    setHandleFeedback("This handle is available");
    form.clearErrors("handle");
    return true;
  };

  const scheduleHandleAvailabilityCheck = (handle: string) => {
    clearPendingHandleCheck();

    if (!isHandleLocallyValid(handle)) {
      setHandleAvailability("idle");
      setHandleFeedback(null);
      return;
    }

    setHandleAvailability("checking");
    setHandleFeedback("Checking handle availability...");

    handleCheckTimeoutRef.current = setTimeout(() => {
      validateHandleAvailability(handle);
    }, HANDLE_CHECK_DEBOUNCE_MS);
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setIsSaving(true);
    try {
      if (!user) {
        toast.error("You must be logged in to update your profile.");
        return;
      }

      const isHandleAvailable = await validateHandleAvailability(values.handle);

      if (!isHandleAvailable) {
        toast.error(HANDLE_UNAVAILABLE_MESSAGE);
        return;
      }

      // Update profiles table (including skills text[])
      const dedupedSkills = [...new Set(skills.map((s) => s.trim()).filter(Boolean))];

      // 1. Build dirty payload and strictly validate against allowlist
      const rawPayload = {
        avatar_theme: values.avatarTheme || null,
        first_name: values.firstName,
        last_name: values.lastName,
        handle: values.handle,
        bio: values.bio || null,
        linkedin_url: values.linkedinUrl || null,
        phone_number: values.phoneNumber || null,
        skills: dedupedSkills,
        expected_graduation_date: values.expectedGraduationDate || null,
        preferred_currency: values.preferredCurrency,
        course_codes: [
          ...new Set(
            courseCodes.map((courseCode) => courseCode.trim().toUpperCase()).filter(Boolean),
          ),
        ],
      };

      const safeData = ProfileUpdateAllowlistSchema.parse(rawPayload);

      // 2. Perform database update with safeData ONLY
      const { error: profileError } = await supabase
        .from("profiles")
        .update(safeData)
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
  const currentHandle = form.watch("handle");
  const isHandleCheckBlocking =
    handleAvailability === "checking" ||
    handleAvailability === "taken" ||
    (handleAvailability === "error" &&
      normalizeProfileHandle(currentHandle || "") !==
        normalizeProfileHandle(profile?.handle || ""));
  const isSubmitDisabled = isSaving || isProfileLoading || !isValid || isHandleCheckBlocking;

  const handleBorderThicknessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setBorderThickness(value);
    document.documentElement.style.setProperty("--border-thickness", `${value}px`);
    localStorage.setItem("theme-border-thickness", String(value));
  };

  const handleBorderRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setBorderRadius(value);
    document.documentElement.style.setProperty("--border-radius", `${value}px`);
    localStorage.setItem("theme-border-radius", String(value));
  };

  useEffect(() => {
    const normalizedCurrent = normalizeProfileHandle(currentHandle || "");
    const normalizedSaved = normalizeProfileHandle(profile?.handle || "");

    if (!normalizedCurrent || normalizedCurrent === normalizedSaved) {
      clearPendingHandleCheck();
      setHandleAvailability(normalizedCurrent ? "available" : "idle");
      setHandleFeedback(normalizedCurrent ? "This is your current handle" : null);
      return;
    }

    if (!isHandleLocallyValid(normalizedCurrent)) {
      clearPendingHandleCheck();
      setHandleAvailability("idle");
      setHandleFeedback(null);
    }
  }, [currentHandle, profile?.handle]);

  const pStats = profile as Record<string, any> | null;

  console.log("PROFILE_QUERY_STATE:", {
    status: profileQuery.status,
    fetchStatus: profileQuery.fetchStatus,
    isLoading: isProfileLoading,
    data: profile,
    error: profileQuery.error,
  });

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
          <Panel title="Integrations">
            <div className="mb-6 border-2 border-black bg-lime/10 p-4 font-mono text-sm">
              <p className="font-bold text-black uppercase mb-2">Spotify</p>
              <p className="text-xs text-gray-700 mb-4">
                Connect your Spotify account to easily export song requests from your events to playlists.
              </p>
              <button
                type="button"
                onClick={() => {
                  // In a real implementation, this would trigger an OAuth flow with Supabase or a custom endpoint
                  // supabase.auth.signInWithOAuth({ provider: 'spotify', options: { scopes: 'playlist-modify-public playlist-modify-private' } })
                  toast.info('Spotify OAuth configuration required.');
                }}
                className="neu-border flex items-center gap-2 bg-[#1DB954] text-white px-4 py-2 font-bold uppercase transition-all hover:scale-105 active:scale-95"
              >
                Link Spotify Profile
              </button>
            </div>
          </Panel>
          {/* ------------------------------- */}
          <Panel title="Profile">
            <AvatarUpload name={currentFullName || "User"} avatarTheme={currentAvatarTheme} />

            <BannerUpload />

            <AvatarThemePicker
              selected={currentAvatarTheme}
              onSelect={(id) => form.setValue("avatarTheme", id, { shouldDirty: true })}
            />

            <div className="mb-6 border-2 border-black bg-lime/10 p-4 font-mono text-sm">
              <p className="font-bold text-black uppercase mb-2">Unlocked Badges</p>
              {badges.length === 0 ? (
                <p className="text-xs text-gray-500 font-bold uppercase">
                  No badges unlocked yet. Keep exploring the campus!
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  {badges.map((b) => (
                    <span
                      key={b.id}
                      title={b.badge_name}
                      className="bg-black text-lime neu-border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider animate-bounce"
                    >
                      🏅 {b.badge_name}
                    </span>
                  ))}
                </div>
              )}
              <p className="font-bold text-black uppercase mb-2">Digital ID Wallet Passes</p>
              <p className="text-xs text-gray-700 mb-4">
                Add your CampusConnect Digital ID Card to your mobile device wallet.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddToAppleWallet}
                  disabled={isWalletDownloading}
                  className="neu-border flex items-center gap-2 bg-white px-4 py-2 font-bold uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  {isWalletDownloading ? "Adding..." : "Add to Apple Wallet"}
                </button>
                <button
                  type="button"
                  onClick={handleAddToGoogleWallet}
                  className="neu-border flex items-center gap-2 bg-white px-4 py-2 font-bold uppercase transition-all hover:scale-105 active:scale-95"
                >
                  <CreditCard className="h-4 w-4" />
                  Add to Google Wallet
                </button>
              </div>
            </div>

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
                        <div className="relative">
                          <input
                            {...field}
                            placeholder="username"
                            aria-invalid={!!errors.handle || handleAvailability === "taken"}
                            aria-describedby="handle-feedback handle-error"
                            onChange={(event) => {
                              field.onChange(event);
                              scheduleHandleAvailabilityCheck(event.target.value);
                            }}
                            onBlur={(event) => {
                              field.onBlur();
                              validateHandleAvailability(event.target.value);
                            }}
                            className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 pr-8 font-mono text-sm outline-none focus:bg-lime/40"
                          />
                          <span className="absolute right-1 top-1/2 -translate-y-1/2">
                            {handleAvailability === "checking" ? (
                              <Loader2
                                className="h-4 w-4 animate-spin text-black/60"
                                aria-label="Checking handle"
                              />
                            ) : handleAvailability === "available" && !errors.handle ? (
                              <Check
                                className="h-4 w-4 text-green-700"
                                aria-label="Handle available"
                              />
                            ) : null}
                          </span>
                        </div>
                      </FormControl>
                      {handleFeedback && !errors.handle ? (
                        <p
                          id="handle-feedback"
                          className={`font-mono text-xs ${
                            handleAvailability === "available"
                              ? "text-green-700"
                              : "text-muted-foreground"
                          }`}
                        >
                          {handleFeedback}
                        </p>
                      ) : null}
                      <FormMessage
                        id="handle-error"
                        className="font-mono text-xs text-destructive"
                      />
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
                  name="preferredCurrency"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="eyebrow font-bold text-black">
                        Price display currency
                      </FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                          aria-describedby="preferred-currency-help"
                        >
                          {SUPPORTED_CURRENCIES.map((currency) => (
                            <option key={currency.code} value={currency.code}>
                              {currency.code} — {currency.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <p id="preferred-currency-help" className="font-mono text-xs text-black/60">
                        Ticket estimates use this currency when available. Checkout remains in USD.
                      </p>
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
                  name="expectedGraduationDate"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="eyebrow font-bold text-black">
                        Expected Graduation Date
                      </FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          type="date"
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
                  render={({ field }) => {
                    const bioValue = field.value || "";
                    const isLimitReached = bioValue.length >= 150;

                    return (
                      <FormItem className="space-y-1">
                        <div className="flex items-center justify-between">
                          <FormLabel className="eyebrow font-bold text-black">Bio</FormLabel>
                          <span
                            aria-label="Character limit"
                            className={`font-mono text-xs font-bold transition-colors ${
                              isLimitReached ? "text-red-600" : "text-muted-foreground"
                            }`}
                          >
                            {bioValue.length}/150 characters
                          </span>
                        </div>
                        <FormControl>
                          <input
                            {...field}
                            maxLength={150}
                            className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                          />
                        </FormControl>
                        <FormMessage className="font-mono text-xs text-destructive" />
                      </FormItem>
                    );
                  }}
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSkillInput(e.target.value)
                      }
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

                <div className="space-y-2 border-t-2 border-black pt-5">
                  <p className="eyebrow font-bold text-black">Courses for study matching</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Add exact course codes to see matching study tables in your Feed.
                  </p>
                  {courseCodes.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {courseCodes.map((courseCode) => (
                        <span
                          key={courseCode}
                          className="neu-border inline-flex items-center gap-1 bg-[#bae6fd] px-2.5 py-1 font-mono text-xs font-bold"
                        >
                          {courseCode}
                          <button
                            type="button"
                            onClick={() => handleRemoveCourseCode(courseCode)}
                            aria-label={`Remove course code ${courseCode}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      ref={courseCodeInputRef}
                      value={courseCodeInput}
                      onChange={(e) => setCourseCodeInput(e.target.value)}
                      onKeyDown={handleCourseCodeKeyDown}
                      placeholder="e.g. CALC 101"
                      maxLength={32}
                      className="flex-1 border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm uppercase outline-none focus:bg-lime/40"
                    />
                    <button
                      type="button"
                      onClick={handleAddCourseCode}
                      aria-label="Add course code"
                      className="neu-border bg-black p-2 text-cream"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
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

              {/* Theme Customizer Trigger */}
              <div className="space-y-2">
                <label className="eyebrow font-bold text-black dark:text-cream">
                  Theme Customizer
                </label>
                <p className="font-mono text-xs text-muted-foreground mb-2">
                  Adjust border thickness and radius dynamically.
                </p>
                <button
                  type="button"
                  onClick={() => setIsThemeDrawerOpen(true)}
                  className="neu-border neu-press flex items-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream"
                >
                  ⚙ Theme Customizer
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="Language Preferences">
            <LanguageSwitcher />
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

            <div className="mt-6 border-t-2 border-black pt-6 space-y-4 text-black">
              <h3 className="font-bold uppercase text-black">Quiet Hours & Timezone</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="timezone" className="font-mono text-xs font-bold uppercase">
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-lime/20"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="quiet-start" className="font-mono text-xs font-bold uppercase">
                    Quiet Start
                  </label>
                  <input
                    id="quiet-start"
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-lime/20"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="quiet-end" className="font-mono text-xs font-bold uppercase">
                    Quiet End
                  </label>
                  <input
                    id="quiet-end"
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-lime/20"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSavePrefs}
                disabled={isSavingPrefs}
                className="neu-border neu-press bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream disabled:opacity-50"
              >
                {isSavingPrefs ? "Saving..." : "Save Notification Preferences"}
              </button>
            </div>
          </Panel>

          <Panel title="Auto-Tagging (Facial Recognition)">
            <AutoTaggingSettings user={user} />
          </Panel>

          <Panel title="Birthday Settings (Privacy Controls)">
            <div className="space-y-4">
              <p className="font-mono text-xs text-muted-foreground">
                If you opt-in, we will notify your Club Executives 3 days before your birthday, and
                optionally post a celebratory shoutout to the club forum. Your birthday is kept
                strictly private otherwise.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="eyebrow font-bold text-black">Birth Date</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full border-2 border-black bg-white px-2 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 sm:pt-6">
                  <div>
                    <label className="eyebrow font-bold text-black">Opt-In to Share</label>
                    <p className="font-mono text-xs text-muted-foreground">
                      Share birthday with Club Executives
                    </p>
                  </div>
                  <Switch checked={shareBirthday} onCheckedChange={setShareBirthday} />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (!user) return;
                      const { error } = await supabase.from("user_private_details").upsert({
                        user_id: user.id,
                        birth_date: birthDate ? birthDate : null,
                        share_birthday: shareBirthday,
                      });
                      if (error) throw error;
                      toast.success("Birthday privacy settings saved!");
                      refetchPrivateDetails();
                    } catch (err: any) {
                      toast.error(err.message || "Failed to save birthday settings.");
                    }
                  }}
                  className="neu-border neu-press bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream hover:scale-105 active:scale-95 transition-all"
                >
                  Save Birthday Settings
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="Privacy / Account">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-black uppercase mb-1">Data Portability & Deletion</h3>
                <p className="font-mono text-xs text-muted-foreground mb-4">
                  Manage your data, request exports of your personal information, or permanently
                  delete your account and all associated data.
                </p>
                <Link
                  to="/settings/data"
                  className="inline-block neu-border neu-press bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream"
                >
                  Manage Data & Privacy
                </Link>
              </div>
            </div>
          </Panel>

          {profile?.role !== "alumni" && (
            <Panel title="Alumni Account Transition" tone="bg-[#e0f2fe]">
              <div className="space-y-4">
                <p className="font-mono text-xs text-gray-700">
                  Graduating soon? Transition your account to an Alumni status. This allows you to
                  retain your profile using a personal email address (like Gmail) after your
                  university email is deactivated.
                </p>
                <div className="bg-amber-50 border-2 border-black p-3 font-mono text-[10px] text-amber-800">
                  ⚠️ Note: A 3-month grace period begins immediately, during which you will retain
                  full student capabilities. After 3 months, you will be restricted from RSVPing to
                  student-only events or holding active club executive roles.
                </div>
                <form onSubmit={handleAlumniTransition} className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="personalEmail" className="eyebrow font-bold text-black">
                      New Personal Email Address
                    </label>
                    <input
                      id="personalEmail"
                      type="email"
                      required
                      placeholder="your.name@gmail.com"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-lime/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isTransitioning || !personalEmail}
                    className="neu-border neu-press bg-[#0284c7] hover:bg-[#0369a1] text-white px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-50"
                  >
                    {isTransitioning ? "Transitioning..." : "Transition Account to Alumni"}
                  </button>
                </form>
              </div>
            </Panel>
          )}

          {profile?.role === "alumni" && (
            <Panel title="Alumni Account Status" tone="bg-[#f0fdf4]">
              <div className="space-y-3 font-mono text-xs text-gray-700">
                <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                  ✓ Alumni Status Active
                </p>
                <p>
                  Transitioned on:{" "}
                  <strong>
                    {profile.alumni_transitioned_at
                      ? new Date(profile.alumni_transitioned_at).toLocaleDateString()
                      : "Recently"}
                  </strong>
                </p>
                {profile.alumni_transitioned_at && (
                  <p>
                    Grace Period Status:{" "}
                    {new Date(profile.alumni_transitioned_at).getTime() + 90 * 24 * 60 * 60 * 1000 >
                    Date.now() ? (
                      <span className="text-blue-700 font-bold">
                        Active (Student privileges remain for summer handover)
                      </span>
                    ) : (
                      <span className="text-gray-500 font-bold">
                        Expired (Standard Alumni restrictions active)
                      </span>
                    )}
                  </p>
                )}
              </div>
            </Panel>
          )}

          <Panel title="Danger zone" tone="bg-red-50">
            <div className="space-y-4">
              <p className="font-mono text-xs text-red-700 font-bold uppercase">
                ⚠️ Danger Zone: Account Deletion (GDPR Right to be Forgotten)
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                This will permanently delete your account, your profile, your event RSVPs, your
                waitlist positions, and clean up any personal files. Your forum posts will be
                anonymized, and transaction records will be scrubbed of PII but retained for
                financial audits.
              </p>
              <button
                onClick={() => setConfirmOpen(true)}
                className="neu-border neu-press bg-red-600 hover:bg-red-700 px-4 py-2 font-mono text-xs font-bold uppercase text-white"
              >
                Delete account
              </button>
            </div>

            <DeleteAccountModal open={confirmOpen} onClose={() => setConfirmOpen(false)} />
          </Panel>
        </div>
      </section>
      {/* Theme Customizer Drawer */}
      {isThemeDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsThemeDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer Panel */}
          <div
            className="relative w-full max-w-sm bg-cream p-6 shadow-[-10px_0_30px_rgba(0,0,0,0.3)] h-full overflow-y-auto border-l-4 border-black flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-black">
                Theme Customizer
              </h2>
              <button
                type="button"
                onClick={() => setIsThemeDrawerOpen(false)}
                className="neu-border flex h-8 w-8 items-center justify-center bg-white text-black hover:bg-black hover:text-white transition-colors"
                aria-label="Close customizer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-8 flex-1">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="eyebrow font-bold text-black">Border Thickness</label>
                  <span className="font-mono font-bold bg-white px-2 py-1 neu-border text-xs text-black">
                    {borderThickness}px
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={borderThickness}
                  onChange={handleBorderThicknessChange}
                  className="w-full cursor-pointer accent-black"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="eyebrow font-bold text-black">Border Radius</label>
                  <span className="font-mono font-bold bg-white px-2 py-1 neu-border text-xs text-black">
                    {borderRadius}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={borderRadius}
                  onChange={handleBorderRadiusChange}
                  className="w-full cursor-pointer accent-black"
                />
              </div>
            </div>

            <div className="pt-6 border-t-2 border-black mt-auto">
              <button
                type="button"
                onClick={() => {
                  setBorderThickness(4);
                  setBorderRadius(8);
                  document.documentElement.style.setProperty("--border-thickness", "4px");
                  document.documentElement.style.setProperty("--border-radius", "8px");
                  localStorage.removeItem("theme-border-thickness");
                  localStorage.removeItem("theme-border-radius");
                }}
                className="w-full neu-border neu-press bg-white text-black px-4 py-3 font-mono text-sm font-bold uppercase hover:bg-gray-100"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
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
function BannerUpload() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadBanner() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("banner_url")
        .eq("id", user.id)
        .single();

      if (isMounted && !error && data?.banner_url) {
        setPreview(data.banner_url);
        setImageError(false);
      }
    }

    loadBanner();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleUploaded(url: string) {
    setPreview(url);
    setImageError(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ banner_url: url })
      .eq("id", user.id);

    if (updateError) {
      console.error(updateError);
      toast.error("Failed to save profile banner.");
    }
  }

  async function handleRemove() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setRemoving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ banner_url: null })
        .eq("id", user.id);
      if (error) throw error;
      setPreview(null);
      setImageError(false);
      toast.success("Banner removed.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove banner.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 border-b-2 border-black pb-6">
      <div>
        <p className="eyebrow font-bold text-black">Profile banner</p>
        <p className="font-mono text-xs text-muted-foreground">
          A wide header image shown behind your avatar. Cropped to 3:1 and compressed automatically
          before upload.
        </p>
      </div>

      {preview && !imageError && (
        <div className="relative w-full overflow-hidden border-2 border-black">
          <OptimizedImage
            src={preview}
            alt="Profile banner preview"
            className="w-full"
            width={1500}
            height={500}
            quality={80}
            responsiveWidths={[600, 1200, 1500]}
            sizes="(max-width: 768px) 100vw, 896px"
            onError={() => setImageError(true)}
            fallback={<div className="h-32 w-full bg-gray-200" aria-hidden="true" />}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <ImageCropUpload
            aspect={3}
            bucket="profile-banners"
            value={preview ?? undefined}
            onUploaded={handleUploaded}
            accept="image/jpeg,image/png,image/webp"
            maxSizeBytes={5 * 1024 * 1024}
            maxWidth={1500}
            label="profile banner"
            hint="JPG, PNG or WEBP · Max 5 MB · Wide 3:1 images look best"
          />
        </div>

        {preview && !imageError && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="neu-border bg-red-100 px-4 py-2 font-mono text-xs font-bold uppercase text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            {removing ? "Removing..." : "Remove banner"}
          </button>
        )}
      </div>
    </div>
  );
}

function ThemeToggle({
  theme,
  setTheme,
}: {
  theme: "light" | "dark" | "system" | "high-contrast";
  setTheme: (theme: "light" | "dark" | "system" | "high-contrast") => void;
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
