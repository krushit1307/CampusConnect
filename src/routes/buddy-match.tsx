import { useState } from "react";
import { Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useAuthHydration } from "@/hooks/useAuthHydration";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getMyBuddyProfile,
  optInToBuddyMatching,
  optOutOfBuddyMatching,
  findBuddyMatches,
  sendWave,
  respondToWave,
  getIncomingWaves,
  type BuddyMatch,
  type IncomingWave,
} from "@/lib/buddyMatcher";
import HeartHandshake from "lucide-react/dist/esm/icons/heart-handshake";
import Hand from "lucide-react/dist/esm/icons/hand";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import UserX from "lucide-react/dist/esm/icons/user-x";

export function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function similarityLabel(similarity: number): string {
  const pct = Math.round(similarity * 100);
  if (pct >= 75) return `${pct}% vibe match`;
  if (pct >= 50) return `${pct}% match`;
  return `${pct}% overlap`;
}

function MatchCard({
  match,
  onWave,
  waving,
}: {
  match: BuddyMatch;
  onWave: (id: string) => void;
  waving: boolean;
}) {
  return (
    <div className="neu-border flex flex-col bg-white p-5 shadow-[6px_6px_0_0_#000] dark:bg-zinc-900">
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 shrink-0 border-2 border-black">
          <AvatarImage src={match.avatar_url ?? undefined} className="object-cover" />
          <AvatarFallback className="bg-lime font-display text-lg font-bold text-black">
            {getInitials(match.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-bold">
            {match.full_name || "Student"}
          </h3>
          {match.handle && <p className="font-mono text-xs text-gray-500">@{match.handle}</p>}
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-peach px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ring-1 ring-black/10">
            <Sparkles className="h-3 w-3" />
            {similarityLabel(match.similarity)}
          </span>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 min-h-[3.75rem] font-mono text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        “{match.bio}”
      </p>

      {match.shared_categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {match.shared_categories.map((category) => (
            <span
              key={category}
              className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-black/70 ring-1 ring-black/10"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      <Button
        type="button"
        onClick={() => onWave(match.user_id)}
        disabled={waving}
        className="neu-border neu-press mt-4 w-full bg-lime font-mono text-xs font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        <Hand className="mr-2 h-4 w-4" />
        Send a Wave
      </Button>
    </div>
  );
}

function WaveCard({
  wave,
  onRespond,
}: {
  wave: IncomingWave;
  onRespond: (waveId: string, accept: boolean) => void;
}) {
  return (
    <div className="neu-border flex items-center gap-3 bg-white p-3 dark:bg-zinc-900">
      <Avatar className="h-10 w-10 shrink-0 border-2 border-black">
        <AvatarImage src={wave.sender.avatar_url ?? undefined} />
        <AvatarFallback className="bg-peach text-xs font-bold text-black">
          {getInitials(wave.sender.full_name)}
        </AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1 truncate font-mono text-xs">
        <span className="font-bold">{wave.sender.full_name || "Someone"}</span> waved at you 👋
      </p>
      <button
        type="button"
        onClick={() => onRespond(wave.id, true)}
        aria-label={`Accept wave from ${wave.sender.full_name || "student"}`}
        className="neu-border neu-press bg-lime px-2 py-1 font-mono text-[10px] font-bold uppercase"
      >
        Accept
      </button>
      <button
        type="button"
        onClick={() => onRespond(wave.id, false)}
        aria-label={`Decline wave from ${wave.sender.full_name || "student"}`}
        className="neu-border neu-press bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase"
      >
        Decline
      </button>
    </div>
  );
}

export default function BuddyMatchPage() {
  const { user, isInitializing } = useAuthHydration();
  const queryClient = useQueryClient();
  const [bioDraft, setBioDraft] = useState("");
  const [wavingTo, setWavingTo] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["buddy-profile", user?.id],
    queryFn: getMyBuddyProfile,
    enabled: Boolean(user),
  });

  const optedIn = Boolean(profileQuery.data?.is_active);

  const matchesQuery = useQuery({
    queryKey: ["buddy-matches", user?.id],
    queryFn: () => findBuddyMatches(5),
    enabled: optedIn,
  });

  const wavesQuery = useQuery({
    queryKey: ["buddy-waves", user?.id],
    queryFn: getIncomingWaves,
    enabled: optedIn,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["buddy-matches"] });
    void queryClient.invalidateQueries({ queryKey: ["buddy-waves"] });
    void queryClient.invalidateQueries({ queryKey: ["buddy-profile"] });
  };

  const optInMutation = useMutation({
    mutationFn: () => optInToBuddyMatching(bioDraft),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("You're in! Finding buddies who share your vibe…");
      invalidateAll();
    },
    onError: () => toast.error("Could not join the matcher. Try again."),
  });

  const optOutMutation = useMutation({
    mutationFn: () => optOutOfBuddyMatching(false),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("You've left the matching pool. Your profile is hidden.");
      invalidateAll();
    },
    onError: () => toast.error("Could not leave the matcher. Try again."),
  });

  const waveMutation = useMutation({
    mutationFn: (receiverId: string) => sendWave(receiverId),
    onSuccess: (result) => {
      setWavingTo(null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Wave sent! 🎉 We'll ping you if they wave back.");
      void queryClient.invalidateQueries({ queryKey: ["buddy-matches", user?.id] });
    },
    onError: () => {
      setWavingTo(null);
      toast.error("Could not send that wave.");
    },
  });

  const respondMutation = useMutation({
    mutationFn: ({ waveId, accept }: { waveId: string; accept: boolean }) =>
      respondToWave(waveId, accept),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.data === "accepted") {
        toast.success("It's a match! Your E2EE chat is ready in Messages.");
      }
      invalidateAll();
    },
    onError: () => toast.error("Could not respond to that wave."),
  });

  if (isInitializing) {
    return (
      <SiteShell>
        <div className="flex h-[60vh] items-center justify-center font-mono text-sm">
          Loading Buddy Matcher…
        </div>
      </SiteShell>
    );
  }

  if (!user) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <HeartHandshake className="mx-auto h-10 w-10" />
          <h1 className="mt-4 font-display text-3xl font-bold">Find your campus buddy</h1>
          <p className="mt-2 font-mono text-sm text-gray-500">
            Sign in to join the (completely opt-in) Buddy Matcher.
          </p>
          <Link
            to="/auth"
            className="neu-border neu-press mt-6 inline-block bg-lime px-6 py-3 font-mono text-sm font-bold uppercase"
          >
            Sign in
          </Link>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="bg-cream dark:bg-zinc-900 min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Hero */}
          <header className="mb-8 rounded-none">
            <h1 className="flex items-center gap-3 font-display text-4xl font-black uppercase tracking-tight md:text-5xl">
              <HeartHandshake className="h-10 w-10 text-[#65a30d]" aria-hidden="true" />
              Buddy Matcher
            </h1>
            <p className="mt-2 max-w-2xl font-mono text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              We compare the categories of events you attend and suggest the students who share your
              vibe — cosine-similarity style. Wave at someone; if they wave back, a private
              end-to-end-encrypted chat opens up.
            </p>
          </header>

          {!optedIn ? (
            /* ─── Opt-in ─── */
            <section className="neu-border mx-auto max-w-xl bg-white p-6 shadow-[8px_8px_0_0_#000] dark:bg-zinc-900">
              <h2 className="font-display text-xl font-bold">Join the matching pool</h2>
              <p className="mt-1 font-mono text-xs text-gray-500">
                Say hi in a sentence or two — this is what potential buddies will see.
              </p>
              <Textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                maxLength={280}
                rows={4}
                placeholder="Rust enthusiast, indie game dev, always up for a hackathon or a badminton rematch…"
                className="neu-border mt-4 w-full bg-cream p-3 font-mono text-sm dark:bg-zinc-800"
                data-testid="buddy-bio-input"
              />
              <div className="mt-1 text-right font-mono text-[10px] text-gray-400">
                {bioDraft.trim().length}/280
              </div>
              <Button
                type="button"
                onClick={() => optInMutation.mutate()}
                disabled={optInMutation.isPending}
                className="neu-border neu-press mt-4 w-full bg-lime font-mono text-sm font-black uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5"
              >
                {optInMutation.isPending ? "Joining…" : "Join & find buddies"}
              </Button>
              <p className="mt-4 flex items-start gap-2 font-mono text-[11px] leading-relaxed text-gray-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Completely opt-in. You can leave instantly from this page at any time, which hides
                your profile from every suggestion immediately.
              </p>
            </section>
          ) : (
            <>
              {/* ─── Incoming waves ─── */}
              {wavesQuery.data && wavesQuery.data.length > 0 && (
                <section className="mb-8" aria-label="Incoming waves">
                  <h2 className="mb-3 font-display text-xl font-bold uppercase">
                    Waves for you 👋
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {wavesQuery.data.map((wave) => (
                      <WaveCard
                        key={wave.id}
                        wave={wave}
                        onRespond={(waveId, accept) => respondMutation.mutate({ waveId, accept })}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Matches ─── */}
              <section aria-label="Your matches">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold uppercase">Your top matches</h2>
                  <button
                    type="button"
                    onClick={() => matchesQuery.refetch()}
                    className="neu-border flex items-center gap-1 px-2 py-1 font-mono text-[10px] font-bold uppercase"
                  >
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                </div>

                {matchesQuery.isLoading ? (
                  <div className="neu-border bg-white p-8 text-center font-mono text-sm dark:bg-zinc-900">
                    Crunching cosine similarities…
                  </div>
                ) : matchesQuery.isError ? (
                  <div className="neu-border bg-red-50 p-8 text-center font-mono text-sm text-red-600">
                    Couldn't load matches right now.
                  </div>
                ) : !matchesQuery.data || matchesQuery.data.length === 0 ? (
                  <div className="neu-border bg-white p-8 text-center dark:bg-zinc-900">
                    <MessageCircle className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
                    <p className="mt-2 font-mono text-sm text-gray-500">
                      No matches yet — RSVP to a few more events and check back soon!
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {matchesQuery.data.map((match) => (
                      <MatchCard
                        key={match.user_id}
                        match={match}
                        waving={wavingTo === match.user_id && waveMutation.isPending}
                        onWave={(id) => {
                          setWavingTo(id);
                          waveMutation.mutate(id);
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ─── Privacy controls ─── */}
              <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-none border-2 border-dashed border-black p-4 sm:flex-row sm:items-center">
                <p className="max-w-md font-mono text-[11px] leading-relaxed text-gray-500">
                  <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />
                  Leaving the pool is instant and reversible — your bio stays saved so you can hop
                  back in later.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => optOutMutation.mutate()}
                  disabled={optOutMutation.isPending}
                  className="neu-border neu-press bg-white font-mono text-xs font-bold uppercase dark:bg-zinc-900"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  {optOutMutation.isPending ? "Leaving…" : "Leave the matching pool"}
                </Button>
              </section>
            </>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
