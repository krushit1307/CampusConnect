import { useState } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation, queryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { generateVoteProof } from "@/lib/zkp";
import { MerkleTree, hash1, stringToBigInt } from "@/lib/merkle";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Vote from "lucide-react/dist/esm/icons/vote";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Plus from "lucide-react/dist/esm/icons/plus";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import { toast } from "sonner";

interface Election {
  id: string;
  title: string;
  merkle_root: string;
  created_at: string;
}

interface Voter {
  id: string;
  commitment: string;
}

interface DBVote {
  id: string;
  choice: string;
  nullifier: string;
}

const CANDIDATES = [
  { id: "1", name: "Alice (Tech Party)", color: "bg-lime" },
  { id: "2", name: "Bob (Art Coalition)", color: "bg-peach" },
  { id: "3", name: "Charlie (Sports Union)", color: "bg-sky" },
];

export default function Elections() {
  const supabase = createClient();
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [voterToken, setVoterToken] = useState("");
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);

  // Fetch elections list
  const {
    data: elections = [],
    isLoading: isLoadingElections,
    refetch: refetchElections,
  } = useQuery<Election[]>({
    queryKey: ["elections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch voters for selected election
  const { data: voters = [], refetch: refetchVoters } = useQuery<Voter[]>({
    queryKey: ["voters", selectedElectionId],
    queryFn: async () => {
      if (!selectedElectionId) return [];
      const { data, error } = await supabase
        .from("eligible_voters")
        .select("id, commitment")
        .eq("election_id", selectedElectionId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedElectionId,
  });

  // Fetch votes for the selected election to show tally
  const { data: votes = [], refetch: refetchVotes } = useQuery<DBVote[]>({
    queryKey: ["votes", selectedElectionId],
    queryFn: async () => {
      if (!selectedElectionId) return [];
      const { data, error } = await supabase
        .from("votes")
        .select("id, choice, nullifier")
        .eq("election_id", selectedElectionId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedElectionId,
  });

  // Create Mock Election Mutation
  const createMockElectionMutation = useMutation({
    mutationFn: async () => {
      const title = `Student Council Election ${new Date().getFullYear()} - ${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Generate 8 mock voter tokens
      const mockTokens = Array.from(
        { length: 8 },
        (_, i) => `voter-token-${i + 1}-${Math.floor(Math.random() * 1000)}`,
      );

      // Calculate leaf commitments
      const commitments = mockTokens.map((t) => hash1(stringToBigInt(t)));

      // Build Merkle tree of depth 8
      const tree = new MerkleTree(8, commitments);
      const root = tree.getRoot().toString();

      // 1. Insert election
      const { data: election, error: electionError } = await supabase
        .from("elections")
        .insert({ title, merkle_root: root })
        .select()
        .single();

      if (electionError) throw electionError;

      // 2. Insert commitments
      const votersData = commitments.map((c) => ({
        election_id: election.id,
        commitment: c.toString(),
      }));

      const { error: votersError } = await supabase.from("eligible_voters").insert(votersData);
      if (votersError) throw votersError;

      return { election, mockTokens };
    },
    onSuccess: (data) => {
      toast.success("Mock election created successfully!");
      refetchElections();
      setSelectedElectionId(data.election.id);

      // Open modal or alert showing tokens to user for copy-pasting
      const tokensStr = data.mockTokens.join("\n");
      alert(
        `Mock Election Created!\n\nHere are 8 eligible voter tokens you can copy and use to vote:\n\n${tokensStr}\n\nKeep them safe! They prove voter eligibility anonymously.`,
      );
    },
    onError: (err: any) => {
      toast.error(`Failed to create mock election: ${err.message}`);
    },
  });

  // Cast Vote Mutation
  const castVoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedElectionId || !selectedCandidate || !voterToken.trim()) {
        throw new Error("Please complete all inputs");
      }

      setIsGeneratingProof(true);
      const election = elections.find((e) => e.id === selectedElectionId);
      if (!election) throw new Error("Election not found");

      // 1. Fetch eligible voters commitments to build the exact tree
      const { data: dbVoters, error: votersErr } = await supabase
        .from("eligible_voters")
        .select("commitment")
        .eq("election_id", selectedElectionId);

      if (votersErr || !dbVoters) throw new Error("Failed to retrieve eligible voters commitments");

      const commitments = dbVoters.map((v) => BigInt(v.commitment));

      // Convert user's token to bigint, and compute user commitment
      const userBigIntToken = stringToBigInt(voterToken.trim());
      const userCommitment = hash1(userBigIntToken);

      // Find user commitment index
      const leafIndex = commitments.indexOf(userCommitment);
      if (leafIndex === -1) {
        throw new Error("Invalid voter token. Not registered as eligible voter in this election.");
      }

      // Build Merkle tree and proof
      const tree = new MerkleTree(8, commitments);
      const proofObj = tree.getProof(leafIndex);

      // 2. Generate ZKP locally using snarkjs
      toast.info("Generating Zero-Knowledge Proof locally on your device...", { duration: 5000 });
      const { proof, publicSignals } = await generateVoteProof(
        userBigIntToken,
        proofObj.pathElements,
        proofObj.pathIndices,
        BigInt(selectedCandidate),
        BigInt(election.merkle_root),
      );

      // 3. Submit proof to Supabase verify-vote Edge Function
      toast.info("Submitting proof to anonymous verification service...", { duration: 3000 });
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proof,
            publicSignals,
            electionId: selectedElectionId,
            voteChoice: selectedCandidate,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Verification failed");
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Vote recorded successfully and anonymously!");
      setVoterToken("");
      setSelectedCandidate(null);
      refetchVotes();
      queryClient.invalidateQueries({ queryKey: ["votes", selectedElectionId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit vote");
    },
    onSettled: () => {
      setIsGeneratingProof(false);
    },
  });

  const selectedElection = elections.find((e) => e.id === selectedElectionId);

  // Compute tallies
  const tallies = CANDIDATES.map((c) => ({
    ...c,
    count: votes.filter((v) => v.choice === c.id).length,
  }));

  const totalVotes = votes.length;

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Neubrutalist Header banner */}
        <div className="neu-border bg-lime p-8 text-center md:p-12 mb-12 shadow-[8px_8px_0_0_#000]">
          <div className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-1.5 font-mono text-xs font-bold uppercase mb-4">
            <Sparkles className="h-4 w-4" /> Cryptographic Integrity
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black text-black uppercase tracking-tight">
            Anonymous Voting
          </h1>
          <p className="mx-auto max-w-2xl font-mono text-sm text-gray-800 mt-4 leading-relaxed">
            Elections powered by local **Zero-Knowledge Proofs (zk-SNARKs)**. Your voter identity is
            cryptographically separated from your choice before it leaves your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel: Elections list */}
          <div className="space-y-6 lg:col-span-1">
            <div className="flex items-center justify-between border-b-4 border-black pb-3">
              <h2 className="font-display text-xl font-bold uppercase">Elections</h2>
              <button
                onClick={() => createMockElectionMutation.mutate()}
                disabled={createMockElectionMutation.isPending}
                className="neu-border neu-press flex items-center gap-1.5 bg-peach px-3 py-1.5 font-mono text-xs font-bold uppercase transition-transform hover:-translate-y-0.5"
              >
                {createMockElectionMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create Mock
              </button>
            </div>

            {isLoadingElections ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : elections.length === 0 ? (
              <div className="neu-border bg-white p-6 text-center">
                <p className="font-mono text-sm text-gray-500">No active elections.</p>
                <p className="font-mono text-xs text-gray-400 mt-1">
                  Click "Create Mock" to start testing.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {elections.map((election) => (
                  <button
                    key={election.id}
                    onClick={() => {
                      setSelectedElectionId(election.id);
                      setSelectedCandidate(null);
                    }}
                    className={`w-full text-left neu-border p-4 transition-transform hover:-translate-y-1 ${
                      selectedElectionId === election.id
                        ? "bg-black text-white shadow-[4px_4px_0_0_#A3E635]"
                        : "bg-white text-black shadow-[4px_4px_0_0_#000]"
                    }`}
                  >
                    <h3 className="font-display font-bold text-lg leading-tight truncate">
                      {election.title}
                    </h3>
                    <p
                      className={`font-mono text-xs mt-2 ${selectedElectionId === election.id ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Root: {election.merkle_root.substring(0, 16)}...
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Voting Form & Tallies */}
          <div className="lg:col-span-2 space-y-8">
            {selectedElection ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Voting form */}
                <div className="neu-border bg-white p-6 shadow-[6px_6px_0_0_#000] space-y-6">
                  <div className="flex items-center gap-2 border-b-2 border-black pb-2">
                    <Vote className="h-5 w-5" />
                    <h3 className="font-display font-bold uppercase">Cast Your Vote</h3>
                  </div>

                  <div>
                    <label className="block font-mono text-xs font-bold uppercase mb-2">
                      Select Candidate
                    </label>
                    <div className="space-y-3">
                      {CANDIDATES.map((candidate) => (
                        <button
                          key={candidate.id}
                          onClick={() => setSelectedCandidate(candidate.id)}
                          className={`w-full neu-border p-3 flex items-center justify-between font-mono text-sm font-bold transition-all hover:bg-gray-50 ${
                            selectedCandidate === candidate.id
                              ? "bg-lime/20 border-lime-600 border-2"
                              : "bg-white"
                          }`}
                        >
                          <span>{candidate.name}</span>
                          <span
                            className={`h-4 w-4 rounded-full border-2 border-black ${
                              selectedCandidate === candidate.id ? "bg-black" : "bg-white"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="token-input"
                      className="block font-mono text-xs font-bold uppercase mb-2"
                    >
                      Voter Token (Secret)
                    </label>
                    <input
                      id="token-input"
                      type="text"
                      placeholder="e.g. voter-token-1-123"
                      value={voterToken}
                      onChange={(e) => setVoterToken(e.target.value)}
                      className="w-full neu-border p-3 font-mono text-sm"
                    />
                    <p className="font-mono text-[10px] text-gray-500 mt-1">
                      * Required to verify eligibility. Never stored or linked to your vote choice.
                    </p>
                  </div>

                  <button
                    onClick={() => castVoteMutation.mutate()}
                    disabled={
                      castVoteMutation.isPending ||
                      isGeneratingProof ||
                      !selectedCandidate ||
                      !voterToken
                    }
                    className="w-full neu-border bg-lime p-3 font-mono text-sm font-black uppercase shadow-[4px_4px_0_0_#000] hover:bg-lime/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isGeneratingProof ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Proof...
                      </>
                    ) : castVoteMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Recording Vote...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Submit Anonymous Vote
                      </>
                    )}
                  </button>
                </div>

                {/* Real-time Tally */}
                <div className="neu-border bg-cream p-6 shadow-[6px_6px_0_0_#000] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-6">
                      <h3 className="font-display font-bold uppercase">Real-Time Tally</h3>
                      <span className="font-mono text-xs font-black uppercase bg-white border border-black px-2 py-0.5">
                        {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
                      </span>
                    </div>

                    <div className="space-y-6">
                      {tallies.map((candidate) => {
                        const percentage =
                          totalVotes > 0 ? (candidate.count / totalVotes) * 100 : 0;
                        return (
                          <div key={candidate.id} className="space-y-1">
                            <div className="flex justify-between font-mono text-xs font-bold">
                              <span>{candidate.name}</span>
                              <span>
                                {candidate.count} ({percentage.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="h-6 w-full bg-white border-2 border-black">
                              <div
                                className={`h-full ${candidate.color} border-r-2 border-black transition-all duration-500`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-8 border-t border-black/10 pt-4 flex items-start gap-2.5 bg-white/50 p-3 border border-black font-mono text-[11px] leading-relaxed text-gray-700">
                    <CheckCircle className="h-4 w-4 shrink-0 text-lime-600" />
                    <span>
                      Each bar represents cryptographically validated votes confirmed via
                      zero-knowledge proofs. No link exists to individual user IDs.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="neu-border bg-white p-12 text-center shadow-[6px_6px_0_0_#000] flex flex-col items-center justify-center">
                <Vote className="h-16 w-16 text-lime mb-4" />
                <h3 className="font-display text-2xl font-bold uppercase">Select an Election</h3>
                <p className="font-mono text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                  Choose an active election from the sidebar to vote or view real-time anonymous
                  results.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
