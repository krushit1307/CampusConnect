import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";

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
            <button className="neu-border neu-press bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream">
              Delete account
            </button>
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
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
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
          aria-label="Change profile picture"
          title="Change profile picture"
          className="neu-border neu-press absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-black text-cream hover:bg-cream hover:text-black"
        >
          <Camera className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      <div className="text-center sm:text-left">
        <p className="eyebrow font-bold">Profile picture</p>
        <p className="font-mono text-xs text-gray-500">JPG or PNG. Square images look best.</p>
      </div>
    </div>
  );
}

function UnderlineInput({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block font-bold">{label}</span>
      <input
        defaultValue={defaultValue}
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
