import { createFileRoute } from "@tanstack/react-router";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SiteShell } from "@/components/site/SiteShell";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CampusConnect" },
      {
        name: "description",
        content: "Manage your CampusConnect profile, notifications, and account.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // TODO: Supabase — load + save profile fields, including avatar upload to storage
  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-sky px-4 py-14 md:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow font-bold">Account</p>
          <h1 className="mt-2 text-4xl font-bold md:text-6xl">Settings.</h1>
        </div>
      </section>
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <Panel title="Profile">
            <AvatarUpload name="Ada Lovelace" />
            <UnderlineInput label="Full name" defaultValue="Ada Lovelace" />
            <UnderlineInput label="Handle" defaultValue="@ada" />
            <UnderlineInput label="College email" defaultValue="ada@college.edu" />
            <UnderlineInput label="Bio" defaultValue="Systems programming, tea, and long walks." />
          </Panel>
          <Panel title="Notifications">
            <Toggle label="Email me about upcoming RSVPs" defaultChecked />
            <Toggle label="Weekly digest of club activity" defaultChecked />
            <Toggle label="New certificates" />
          </Panel>
          <Panel title="Danger zone" tone="bg-peach">
            <button
              onClick={() => setConfirmOpen(true)}
              className="neu-border neu-press bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream"
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

function AvatarUpload({ name }: { name: string }) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
      }
    }

    loadAvatar();

    return () => {
      isMounted = false;
    };
  }, []);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
        toast.success("Profile picture updated.");
        setUploading(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload avatar.");
    } finally {
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

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage.from("avatars").upload(filePath, file, {
      upsert: true,
    });

    if (error) {
      throw error;
    }

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
        <div className="neu-border flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-lime">
          {preview ? (
            <img
              src={preview}
              alt="Profile picture preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-display text-2xl font-bold">{initials}</span>
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
        <p className="eyebrow font-bold">Profile picture</p>
        <p className="font-mono text-xs text-gray-500">
          JPG, PNG or WEBP. Max 2 MB. Square images look best.
        </p>
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
