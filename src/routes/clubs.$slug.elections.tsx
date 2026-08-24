import { useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { ElectionBallot } from "@/components/Elections/ElectionBallot";
import { ElectionResults } from "@/components/Elections/ElectionResults";
import { CreateElectionForm } from "@/components/Elections/CreateElectionForm";
import { type Election, getClubElections } from "@/lib/supabase/elections";
import { Plus, Vote, Trophy, Lock } from "lucide-react";

export default function ClubElectionsRoute() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = createClient();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: club, isLoading: clubLoading } = useQuery({
    queryKey: ["club", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, slug")
        .eq("slug", slug || "")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!slug,
  });

  const [elections, setElections] = useState<Election[]>([]);
  const [electionsLoading, setElectionsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refreshElections = async () => {
    if (!club) return;
    setElectionsLoading(true);
    const { data } = await getClubElections(club.id);
    setElections(data ?? []);
    setElectionsLoading(false);
  };

  // Load elections when club is available
  useQuery({
    queryKey: ["club-elections", club?.id],
    queryFn: async () => {
      if (!club) return [];
      const { data } = await getClubElections(club.id);
      setElections(data ?? []);
      setElectionsLoading(false);
      return data;
    },
    enabled: !!club,
  });

  if (clubLoading) {
    return (
      <SiteShell>
        <div className="flex h-64 w-full items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </SiteShell>
    );
  }

  if (!club) return <Navigate to="/404" replace />;

  const selected = elections.find((e) => e.id === selectedId);
  const openCount = elections.filter((e) => e.status === "open").length;
  const closedCount = elections.filter((e) => e.status === "closed").length;

  return (
    <SiteShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="neu-border bg-lime p-8 text-center shadow-[8px_8px_0_0_#000] mb-10">
          <div className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-1.5 font-mono text-xs font-bold uppercase mb-3">
            <Vote size={14} /> Decentralized Voting
          </div>
          <h1 className="font-display text-4xl font-black uppercase tracking-tight">
            {club.name} Elections
          </h1>
          <p className="font-mono text-sm text-gray-800 mt-2 max-w-xl mx-auto">
            Anonymous, cryptographically verifiable elections. Your vote is stored separately from
            your identity — only a receipt hash proves you voted.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar — election list */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-center justify-between border-b-4 border-black pb-3">
              <h2 className="font-display text-lg font-bold uppercase">Elections</h2>
              <button
                onClick={() => {
                  setShowCreateForm(!showCreateForm);
                  setSelectedId(null);
                }}
                className="neu-border neu-press flex items-center gap-1 bg-peach px-3 py-1.5 font-mono text-xs font-bold uppercase"
              >
                <Plus size={12} /> New
              </button>
            </div>

            {electionsLoading ? (
              <div className="py-8 text-center font-mono text-sm text-gray-500">Loading…</div>
            ) : elections.length === 0 ? (
              <div className="neu-border bg-white p-6 text-center">
                <p className="font-mono text-sm text-gray-500">No elections yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {elections.map((el) => {
                  const isActive = selectedId === el.id;
                  const statusColor =
                    el.status === "open"
                      ? "bg-lime"
                      : el.status === "closed"
                        ? "bg-sky"
                        : "bg-gray-200";
                  return (
                    <button
                      key={el.id}
                      onClick={() => {
                        setSelectedId(el.id);
                        setShowCreateForm(false);
                      }}
                      className={`w-full text-left neu-border p-4 transition-transform hover:-translate-y-0.5 ${
                        isActive
                          ? "bg-black text-white shadow-[4px_4px_0_0_#A3E635]"
                          : "bg-white text-black shadow-[4px_4px_0_0_#000]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display font-bold leading-tight truncate">
                          {el.title}
                        </h3>
                        <span
                          className={`shrink-0 h-3 w-3 rounded-full border border-black ${statusColor}`}
                          title={el.status}
                        />
                      </div>
                      <p
                        className={`font-mono text-[11px] mt-1 uppercase ${isActive ? "text-gray-400" : "text-gray-500"}`}
                      >
                        {el.status} · closes {new Date(el.end_time).toLocaleDateString()}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="neu-border bg-white p-3 font-mono text-[11px] text-gray-500 space-y-1">
              <p>
                <span className="font-bold">{elections.length}</span> total ·{" "}
                <span className="font-bold text-lime-600">{openCount}</span> open ·{" "}
                <span className="font-bold">{closedCount}</span> closed
              </p>
            </div>
          </div>

          {/* Main panel — form, ballot, or results */}
          <div className="lg:col-span-2">
            {showCreateForm ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b-4 border-black pb-3">
                  <Plus size={18} />
                  <h2 className="font-display text-xl font-bold uppercase">Create Election</h2>
                </div>
                <CreateElectionForm
                  clubId={club.id}
                  onOpened={(el) => {
                    setShowCreateForm(false);
                    refreshElections();
                    setSelectedId(el.id);
                  }}
                />
              </div>
            ) : selected ? (
              <div className="space-y-6">
                <div className="neu-border bg-white p-5 shadow-[6px_6px_0_0_#000]">
                  <h2 className="font-display text-2xl font-bold">{selected.title}</h2>
                  {selected.description && (
                    <p className="font-mono text-sm text-gray-600 mt-1">{selected.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3 font-mono text-xs uppercase">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 border border-black font-bold ${
                        selected.status === "open"
                          ? "bg-lime"
                          : selected.status === "closed"
                            ? "bg-sky"
                            : "bg-gray-200"
                      }`}
                    >
                      {selected.status === "open" && <Vote size={10} />}
                      {selected.status === "closed" && <Trophy size={10} />}
                      {selected.status === "draft" && <Lock size={10} />}
                      {selected.status}
                    </span>
                    <span>closes {new Date(selected.end_time).toLocaleString()}</span>
                    {selected.tie_extension_count > 0 && (
                      <span className="text-amber-600">
                        (extended {selected.tie_extension_count}× for ties)
                      </span>
                    )}
                  </div>
                </div>

                {selected.status === "open" && (
                  <ElectionBallot election={selected} onVoted={refreshElections} />
                )}

                {(selected.status === "closed" || selected.status === "open") && (
                  <ElectionResults election={selected} />
                )}

                {selected.status === "draft" && (
                  <div className="neu-border bg-cream p-8 text-center">
                    <Lock size={28} className="mx-auto mb-2" />
                    <p className="font-mono text-sm font-bold uppercase">
                      Voting hasn't opened yet. Admins can add candidates and open the election.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="neu-border bg-white p-12 text-center shadow-[6px_6px_0_0_#000]">
                <Vote size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="font-display text-xl font-bold uppercase">Select an Election</h3>
                <p className="font-mono text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                  Choose an election from the sidebar to vote or view results.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
