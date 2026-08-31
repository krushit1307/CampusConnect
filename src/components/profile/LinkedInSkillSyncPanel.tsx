import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Linkedin, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface LinkedInSkillSyncPanelProps {
  userId: string;
  skills: string[];
}

interface SyncRecord {
  certificate_id: string;
  skill_name: string;
  verification_url: string;
  status: "pending" | "synced" | "needs_reconnect" | "unavailable" | "failed";
  last_error: string | null;
  synced_at: string | null;
}

export function LinkedInSkillSyncPanel({ userId, skills }: LinkedInSkillSyncPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [connected, setConnected] = useState(false);
  const [consent, setConsent] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(skills[0] || "");
  const [sync, setSync] = useState<SyncRecord | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadStatus = async () => {
    const [{ data: connection }, { data: latestSync }] = await Promise.all([
      supabase.from("linkedin_connections").select("user_id").eq("user_id", userId).maybeSingle(),
      supabase
        .from("linkedin_certificate_syncs")
        .select("certificate_id, skill_name, verification_url, status, last_error, synced_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setConnected(Boolean(connection));
    setSync((latestSync as SyncRecord | null) || null);
  };

  useEffect(() => {
    void loadStatus();
    const params = new URLSearchParams(window.location.search);
    const result = params.get("linkedin");
    if (result === "connected")
      toast.success("LinkedIn connected. Review your skill before syncing it.");
    if (result && result !== "connected") toast.error("LinkedIn connection was not completed.");
    if (result) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [userId]);

  useEffect(() => {
    if (!skills.includes(selectedSkill)) setSelectedSkill(skills[0] || "");
  }, [skills, selectedSkill]);

  const invoke = async (action: string) => {
    setIsBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("linkedin-skill-sync", {
        body: { action, skill: selectedSkill },
      });
      if (error) throw error;
      return data as {
        authorization_url?: string;
        status?: SyncRecord["status"];
        verification_url?: string;
        message?: string;
      };
    } finally {
      setIsBusy(false);
    }
  };

  const connect = async () => {
    try {
      const result = await invoke("authorize");
      if (!result.authorization_url)
        throw new Error("LinkedIn authorization URL was not returned.");
      window.location.assign(result.authorization_url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start LinkedIn authorization.",
      );
    }
  };

  const syncCertificate = async () => {
    if (!consent) {
      toast.error("Confirm that you want CampusConnect to update your LinkedIn profile first.");
      return;
    }
    if (!selectedSkill) {
      toast.error("Add at least one skill to your profile before syncing.");
      return;
    }
    try {
      const result = await invoke("sync");
      await loadStatus();
      if (result.status === "synced") toast.success("Your certificate was added to LinkedIn.");
      else toast.message(result.message || "Your verification link is ready to share.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync your certificate.");
    }
  };

  return (
    <section
      className="neu-border bg-[#e8f4ff] p-5 text-black"
      aria-labelledby="linkedin-sync-heading"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2 font-bold">
            <Linkedin className="h-4 w-4" /> Professional visibility
          </p>
          <h2 id="linkedin-sync-heading" className="font-display mt-1 text-xl font-bold">
            Sync a verified skill to LinkedIn
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-black/70">
            CampusConnect will only act after you connect LinkedIn and confirm this update. Your
            certificate remains verifiable through its public verification link even when LinkedIn
            access is unavailable.
          </p>
        </div>
        <ShieldCheck className="h-8 w-8 shrink-0" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="font-mono text-xs font-bold">
          Certificate skill
          <select
            value={selectedSkill}
            onChange={(event) => setSelectedSkill(event.target.value)}
            className="mt-1 block w-full border-2 border-black bg-white px-3 py-2 text-sm"
            disabled={skills.length === 0}
          >
            {skills.length === 0 ? (
              <option value="">Add a skill in your profile first</option>
            ) : (
              skills.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))
            )}
          </select>
        </label>
        {!connected ? (
          <button
            type="button"
            onClick={() => void connect()}
            disabled={isBusy}
            className="neu-border self-end bg-black px-4 py-2 font-mono text-xs font-bold text-white disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Connect LinkedIn"}
          </button>
        ) : (
          <span className="self-end font-mono text-xs font-bold text-emerald-800">
            LinkedIn connected
          </span>
        )}
      </div>
      {connected && (
        <div className="mt-4 border-t-2 border-black/20 pt-4">
          <label className="flex items-start gap-2 font-mono text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-black"
            />
            <span>
              I authorize CampusConnect to add this verified certificate to my LinkedIn profile. I
              understand the LinkedIn API may require partner approval and that a verification URL
              will be provided as a fallback.
            </span>
          </label>
          <button
            type="button"
            onClick={() => void syncCertificate()}
            disabled={isBusy || !selectedSkill}
            className="neu-border mt-3 inline-flex items-center gap-2 bg-lime px-4 py-2 font-mono text-xs font-bold disabled:opacity-50"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}{" "}
            Sync verified certificate
          </button>
        </div>
      )}
      {sync && (
        <div className="mt-4 border-t-2 border-black/20 pt-4 font-mono text-xs">
          <p className="font-bold uppercase">Latest sync: {sync.status.replace("_", " ")}</p>
          {sync.last_error && (
            <p className="mt-1 text-red-800">LinkedIn response: {sync.last_error}</p>
          )}
          <a
            href={sync.verification_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-bold underline"
          >
            <ExternalLink className="h-3 w-3" /> Open verification link
          </a>
        </div>
      )}
    </section>
  );
}
