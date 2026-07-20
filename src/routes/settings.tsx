import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SiteShell } from "@/components/site/SiteShell";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient, getSupabaseUrl } from "@/lib/supabase/client";

import { Progress } from "@/components/ui/progress";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [borderThickness, setBorderThickness] = useState(2);
  const [borderRadius, setBorderRadius] = useState(0);
  const { fontSize, increment, decrement, reset } = useFontSize();

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
      fullName: "",
      handle: "",
      collegeEmail: "",
      bio: "",
      linkedinUrl: "",
      phoneNumber: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        avatarTheme: (profile?.avatar_theme as AvatarThemeId) || "",
        fullName: profile?.full_name || user.user_metadata?.full_name || "",
        handle: profile?.handle || "",
        collegeEmail: user.email || "",
        bio: profile?.bio || "",
        linkedinUrl: profile?.linkedin_url || "",
        phoneNumber: profile?.phone_number || "",
      });
    }
  }, [profile, user, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    setIsSaving(true);
    try {
      if (!user) {
        toast.error("You must be logged in to update your profile.");
        return;
      }

      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_theme: values.avatarTheme || null,
          full_name: values.fullName,
          handle: values.handle,
          bio: values.bio || null,
          linkedin_url: values.linkedinUrl || null,
          phone_number: values.phoneNumber || null,
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

  const currentFullName = form.watch("fullName");
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
      <section className="border-b-2 border-black px-4 py-14 md:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow font-bold text-black">Account</p>
          <h1 className="mt-2 text-4xl font-bold text-[#123a57] md:text-6xl text-black">
            Settings.
          </h1>
        </div>
      </section>
      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl space-y-6 text-indigo-900">
          <Panel title="Profile">
            <AvatarUpload name={currentFullName || "User"} avatarTheme={currentAvatarTheme} />

            <AvatarThemePicker
              selected={currentAvatarTheme}
              onSelect={(id) => form.setValue("avatarTheme", id, { shouldDirty: true })}
            />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel required className="eyebrow font-bold text-black">
                        Full name
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
                <p className="font-mono text-xs text-gray-500">
                  Controls the width of borders throughout the app (1px - 8px)
                </p>
              </div>

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
                <p className="font-mono text-xs text-gray-500">
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
              className="neu-border neu-press bg-[#123a57] px-4 py-2 font-mono text-xs font-bold uppercase text-white"
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
                console.log("Delete account confirmed");
                setConfirmOpen(false);
              }}
            />
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
    <section className={`neu-border ${tone} p-6`}>
      <h2 className="mb-4 border-b-2 border-black pb-3 text-xl font-bold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function uploadFileWithProgress(
  supabaseUrl: string,
  accessToken: string,
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${supabaseUrl}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed due to a network error"));
    };

    xhr.send(file);
  });
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
      <p className="font-mono text-xs text-gray-500">
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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

      console.log("Loaded avatar:", data?.avatar_url);
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

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Only fall back to a gradient when there's no uploaded photo to show.
  // A real photo always takes priority over the theme.
  const showGradient = (!preview || imageError) && !!avatarTheme;
  const gradientClass = AVATAR_THEMES.find((theme) => theme.id === avatarTheme)?.gradient;
  const backgroundClass = showGradient && gradientClass ? gradientClass : "bg-lime";

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG and WEBP images are allowed.");
      return;
    }

    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error("Image must be under 2 MB.");
      return;
    }
    setUploading(true);

    try {
      const avatarUrl = await uploadAvatar(file);
      console.log("Avatar URL:", avatarUrl);

      if (avatarUrl) {
        setPreview(avatarUrl);
        setImageError(false);
        toast.success("Profile picture updated.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload avatar.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function uploadAvatar(file: File): Promise<string | undefined> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Please sign in first.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      toast.error("Session expired. Please sign in again.");
      return;
    }

    const supabaseUrl = getSupabaseUrl();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

    await uploadFileWithProgress(
      supabaseUrl,
      session.access_token,
      "avatars",
      filePath,
      file,
      setUploadProgress,
    );
    setUploadProgress(null);

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
      })
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    return publicUrl;
  }

  return (
    <div className="flex flex-col items-center gap-3 border-b-2 border-black pb-6 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative shrink-0">
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Change profile picture"
          title="Change profile picture"
          className="neu-border neu-press absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-black text-cream hover:bg-cream hover:text-black"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      <div className="text-center sm:text-left">
        <p className="eyebrow font-bold text-black">Profile picture</p>
        <p className="font-mono text-xs text-gray-500">
          JPG, PNG or WEBP. Max 2 MB. Square images look best.
        </p>
        {uploadProgress !== null && (
          <div className="mt-2 w-full space-y-1">
            <Progress value={uploadProgress} className="h-2" />
            <p className="font-mono text-xs text-gray-500">{uploadProgress}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UnderlineInput({
  label,
  defaultValue,
  required,
}: {
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block font-bold">
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <input
        defaultValue={defaultValue}
        required={required}
        className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
      />
    </label>
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
