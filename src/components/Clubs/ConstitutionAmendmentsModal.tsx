import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { RichTextDiffViewer } from "@/components/ui/RichTextDiffViewer";
import { Gavel, Plus, Check, X, Clock, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ConstitutionAmendmentsModalProps {
  clubId: string;
  isOrganizer: boolean;
  isOpen: boolean;
  onClose: () => void;
  onAmendmentPassed?: () => void;
}

export function ConstitutionAmendmentsModal({
  clubId,
  isOrganizer,
  isOpen,
  onClose,
  onAmendmentPassed,
}: ConstitutionAmendmentsModalProps) {
  const [isProposeOpen, setIsProposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [proposedText, setProposedText] = useState("");
  const [expandedAmendmentId, setExpandedAmendmentId] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ["current_user_amendments"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch all amendments with their votes joined
  const {
    data: amendments = [],
    refetch: refetchAmendments,
    isLoading,
  } = useQuery({
    queryKey: ["constitution_amendments", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("constitution_amendments")
        .select("*, amendment_votes(*)")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });

  // Propose amendment mutation
  const proposeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to propose an amendment.");
      if (!title.trim() || !originalText.trim() || !proposedText.trim()) {
        throw new Error("Title, original text, and proposed text are required.");
      }

      const { data, error } = await supabase
        .from("constitution_amendments")
        .insert({
          club_id: clubId,
          title: title.trim(),
          description: description.trim(),
          original_text: originalText.trim(),
          proposed_text: proposedText.trim(),
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Amendment proposed successfully! 7-day voting window opened.");
      setIsProposeOpen(false);
      setTitle("");
      setDescription("");
      setOriginalText("");
      setProposedText("");
      refetchAmendments();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to propose amendment.");
    },
  });

  // Vote casting mutation
  const voteMutation = useMutation({
    mutationFn: async ({ amendmentId, vote }: { amendmentId: string; vote: boolean }) => {
      const { data, error } = await supabase.rpc("cast_amendment_vote", {
        p_amendment_id: amendmentId,
        p_vote: vote,
      });
      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Vote registered successfully!");
      refetchAmendments();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cast vote.");
    },
  });

  // Close & Tally mutation
  const resolveMutation = useMutation({
    mutationFn: async (amendmentId: string) => {
      const { data, error } = await supabase.rpc("close_amendment_voting", {
        p_amendment_id: amendmentId,
      });
      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.message);
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.status === "PASSED") {
        toast.success("Amendment passed and merged successfully!");
        if (onAmendmentPassed) onAmendmentPassed();
      } else {
        toast.info("Amendment resolved: FAILED to pass.");
      }
      refetchAmendments();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to resolve voting.");
    },
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex w-full max-w-5xl flex-col bg-white border-4 border-black shadow-[8px_8px_0_0_#000] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black bg-purple-300 p-4">
          <div className="flex items-center gap-2">
            <Gavel className="h-6 w-6 text-black" />
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
              Constitution Amendments
            </h2>
          </div>
          <button
            onClick={onClose}
            className="neu-border bg-red-400 px-3 py-1 font-mono text-sm font-bold uppercase hover:bg-red-500 transition-colors text-black"
          >
            Close
          </button>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isProposeOpen ? (
            /* Proposal Form Panel */
            <div className="neu-border bg-yellow-50 p-6 space-y-4">
              <h3 className="font-display text-lg font-bold uppercase text-black">
                Propose Amendment
              </h3>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase text-gray-700">
                    Amendment Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Extend Treasurer's Term to 2 Years"
                    className="neu-border p-2 focus:outline-none bg-white text-black"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase text-gray-700">
                    Detailed Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide reasoning for this amendment..."
                    rows={3}
                    className="neu-border p-2 focus:outline-none bg-white text-black"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-red-700 uppercase">
                      Original Text Clause
                    </label>
                    <textarea
                      value={originalText}
                      onChange={(e) => setOriginalText(e.target.value)}
                      placeholder="Paste the exact text snippet to be replaced..."
                      rows={6}
                      className="neu-border p-2 focus:outline-none bg-white border-red-300 text-black"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-green-700 uppercase">
                      Proposed Replacement
                    </label>
                    <textarea
                      value={proposedText}
                      onChange={(e) => setProposedText(e.target.value)}
                      placeholder="Enter the proposed new text snippet..."
                      rows={6}
                      className="neu-border p-2 focus:outline-none bg-white border-green-300 text-black"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 font-mono text-xs">
                <button
                  onClick={() => setIsProposeOpen(false)}
                  className="neu-border bg-white hover:bg-gray-100 px-4 py-2 font-bold uppercase text-black"
                >
                  Cancel
                </button>
                <button
                  onClick={() => proposeMutation.mutate()}
                  disabled={proposeMutation.isPending}
                  className="neu-border bg-green-300 hover:bg-green-400 px-4 py-2 font-bold uppercase text-black flex items-center gap-1"
                >
                  {proposeMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Submit Proposal
                </button>
              </div>
            </div>
          ) : (
            /* Main List View */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="font-mono text-sm text-gray-600">
                  Total Bylaw Amendments Proposed: {amendments.length}
                </p>
                {isOrganizer && (
                  <button
                    onClick={() => setIsProposeOpen(true)}
                    className="flex items-center gap-2 neu-border bg-blue-300 px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-blue-400 transition-colors text-black"
                  >
                    <Plus className="h-4 w-4" />
                    Propose Amendment
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
              ) : amendments.length === 0 ? (
                <div className="neu-border bg-gray-50 p-8 text-center font-mono text-gray-500">
                  No amendments have been proposed for this club yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {amendments.map((amendment: any) => {
                    const yesVotes =
                      amendment.amendment_votes?.filter((v: any) => v.vote === true).length || 0;
                    const noVotes =
                      amendment.amendment_votes?.filter((v: any) => v.vote === false).length || 0;
                    const totalVotes = yesVotes + noVotes;
                    const myVote = amendment.amendment_votes?.find(
                      (v: any) => v.user_id === user?.id,
                    )?.vote;

                    const approvalRate = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
                    const isExpired = new Date(amendment.expires_at) <= new Date();

                    return (
                      <div
                        key={amendment.id}
                        className="neu-border bg-white p-5 space-y-4 shadow-[4px_4px_0_0_#000]"
                      >
                        {/* Title Bar */}
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className="font-display text-lg font-black uppercase text-black">
                              {amendment.title}
                            </h4>
                            <p className="font-mono text-xs text-gray-500 mt-0.5">
                              Proposed on {new Date(amendment.created_at).toLocaleDateString()} by
                              Organizer
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {amendment.status === "PENDING" ? (
                              <span className="flex items-center gap-1 neu-border bg-yellow-200 px-2 py-0.5 font-mono text-xs font-bold uppercase text-black">
                                <Clock className="h-3 w-3" />
                                {isExpired ? "Expired" : "Active"}
                              </span>
                            ) : amendment.status === "PASSED" ? (
                              <span className="neu-border bg-green-200 px-2 py-0.5 font-mono text-xs font-bold uppercase text-green-800">
                                Passed
                              </span>
                            ) : (
                              <span className="neu-border bg-red-200 px-2 py-0.5 font-mono text-xs font-bold uppercase text-red-800">
                                Failed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        {amendment.description && (
                          <p className="font-mono text-sm text-gray-700 bg-gray-50 p-3 border-l-4 border-black">
                            {amendment.description}
                          </p>
                        )}

                        {/* Collapsible Diff Viewer Toggle */}
                        <div>
                          <button
                            onClick={() =>
                              setExpandedAmendmentId(
                                expandedAmendmentId === amendment.id ? null : amendment.id,
                              )
                            }
                            className="font-mono text-xs font-bold underline hover:text-purple-600 transition-colors text-black focus:outline-none"
                          >
                            {expandedAmendmentId === amendment.id
                              ? "Hide Snippet Diff"
                              : "Show Side-by-Side Diff"}
                          </button>

                          {expandedAmendmentId === amendment.id && (
                            <div className="mt-3">
                              <RichTextDiffViewer
                                oldText={amendment.original_text}
                                newText={amendment.proposed_text}
                                mode="split"
                                title="Amendment Snippet Comparison"
                              />
                            </div>
                          )}
                        </div>

                        {/* Voting Tally Progress */}
                        <div className="space-y-2 font-mono text-xs text-black">
                          <div className="flex justify-between items-center">
                            <span>
                              Yes: {yesVotes} votes ({Math.round(approvalRate)}%)
                            </span>
                            <span>
                              No: {noVotes} votes ({Math.round(100 - approvalRate)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 h-4 border-2 border-black relative overflow-hidden">
                            <div
                              style={{ width: `${approvalRate}%` }}
                              className="bg-green-300 h-full border-r-2 border-black"
                            />
                            <div
                              className="absolute top-0 bottom-0 left-[66%] w-0.5 bg-red-600 z-10"
                              title="66% Supermajority Target"
                            />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-gray-500">
                            <span>Total Cast: {totalVotes} votes</span>
                            <span>66% approval required to pass</span>
                          </div>
                        </div>

                        {/* Action buttons (voting & resolution) */}
                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-3">
                          {/* Voter Cast Controls */}
                          {amendment.status === "PENDING" && !isExpired ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  voteMutation.mutate({ amendmentId: amendment.id, vote: true })
                                }
                                disabled={voteMutation.isPending}
                                className={`flex items-center gap-1 neu-border px-3 py-1 font-mono text-xs font-bold uppercase transition-colors text-black ${
                                  myVote === true ? "bg-green-300" : "bg-white hover:bg-green-50"
                                }`}
                              >
                                <Check className="h-3 w-3" />
                                Yes
                              </button>
                              <button
                                onClick={() =>
                                  voteMutation.mutate({ amendmentId: amendment.id, vote: false })
                                }
                                disabled={voteMutation.isPending}
                                className={`flex items-center gap-1 neu-border px-3 py-1 font-mono text-xs font-bold uppercase transition-colors text-black ${
                                  myVote === false ? "bg-red-300" : "bg-white hover:bg-red-50"
                                }`}
                              >
                                <X className="h-3 w-3" />
                                No
                              </button>
                              {myVote !== undefined && (
                                <span className="font-mono text-xs text-gray-500 flex items-center ml-2">
                                  Your choice registered
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-500 font-mono text-xs">
                              {amendment.status === "PENDING"
                                ? "Voting window closed. Awaiting resolution."
                                : `Closed: Resolved as ${amendment.status}`}
                            </div>
                          )}

                          {/* Resolution Controls for Admins */}
                          {amendment.status === "PENDING" && (isOrganizer || isExpired) && (
                            <button
                              onClick={() => resolveMutation.mutate(amendment.id)}
                              disabled={resolveMutation.isPending}
                              className="neu-border bg-purple-300 hover:bg-purple-400 px-4 py-1.5 font-mono text-xs font-bold uppercase text-black flex items-center gap-1"
                            >
                              {resolveMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ArrowRight className="h-3 w-3" />
                              )}
                              Resolve & Tally Votes
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
