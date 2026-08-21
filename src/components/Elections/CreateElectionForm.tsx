import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, PlayCircle } from "lucide-react";
import {
  type Election,
  type Candidate,
  createElection,
  addCandidate,
  openElection,
  getCandidates,
} from "@/lib/supabase/elections";
import { CandidateManifestoUpload } from "@/components/Elections/CandidateManifestoUpload";

export type CreateElectionFormProps = {
  clubId: string;
  /** Called once the election has been opened, so the parent can switch to the ballot view. */
  onOpened?: (election: Election) => void;
};

/**
 * Admin-only flow: create an election (starts as 'draft'), add candidates
 * and let them upload their platforms, then explicitly open voting. Every
 * step here is also enforced server-side by RLS — this form just gives
 * admins a straightforward way to drive it.
 */
export function CreateElectionForm({ clubId, onOpened }: CreateElectionFormProps) {
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endTime, setEndTime] = useState("");
  const [creating, setCreating] = useState(false);

  const [candidateName, setCandidateName] = useState("");
  const [candidateBio, setCandidateBio] = useState("");
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [opening, setOpening] = useState(false);

  const refreshCandidates = async (electionId: string) => {
    const { data, error } = await getCandidates(electionId);
    if (!error) setCandidates(data ?? []);
  };

  useEffect(() => {
    if (election) refreshCandidates(election.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [election?.id]);

  const handleCreateElection = async () => {
    if (!title.trim() || !endTime) {
      toast.error("Give the election a title and a closing date.");
      return;
    }
    const parsedEndTime = new Date(endTime);
    if (parsedEndTime <= new Date()) {
      toast.error("The closing date must be in the future.");
      return;
    }

    setCreating(true);
    const { data, error } = await createElection({
      clubId,
      title: title.trim(),
      description: description.trim() || undefined,
      endTime: parsedEndTime,
    });
    setCreating(false);

    if (error || !data) {
      toast.error("Couldn't create the election.");
      return;
    }
    setElection(data);
    toast.success("Election created as a draft. Add candidates, then open it when ready.");
  };

  const handleAddCandidate = async () => {
    if (!election || !candidateName.trim()) return;

    setAddingCandidate(true);
    const { error } = await addCandidate({
      electionId: election.id,
      name: candidateName.trim(),
      bio: candidateBio.trim() || undefined,
      ballotPosition: candidates.length,
    });
    setAddingCandidate(false);

    if (error) {
      toast.error("Couldn't add that candidate.");
      return;
    }
    setCandidateName("");
    setCandidateBio("");
    await refreshCandidates(election.id);
  };

  const handleOpenElection = async () => {
    if (!election) return;
    if (candidates.length < 2) {
      toast.error("Add at least two candidates before opening voting.");
      return;
    }

    setOpening(true);
    const { data, error } = await openElection(election.id);
    setOpening(false);

    if (error || !data) {
      toast.error("Couldn't open voting.");
      return;
    }
    toast.success("Voting is open. The ballot is now locked — no more candidate changes.");
    onOpened?.(data);
  };

  if (!election) {
    return (
      <div className="neu-border flex flex-col gap-3 bg-white p-4 dark:bg-zinc-900">
        <h3 className="font-mono text-sm font-bold uppercase">New election</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Spring Executive Election"
          className="neu-border bg-white p-2 font-mono text-sm outline-none dark:bg-zinc-800"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
          className="neu-border bg-white p-2 font-mono text-sm outline-none dark:bg-zinc-800"
        />
        <label className="flex flex-col gap-1 font-mono text-xs uppercase text-gray-600 dark:text-zinc-400">
          Voting closes
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="neu-border bg-white p-2 font-mono text-sm normal-case outline-none dark:bg-zinc-800"
          />
        </label>
        <Button type="button" variant="primary" disabled={creating} onClick={handleCreateElection}>
          {creating ? "Creating…" : "Create draft"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="neu-border bg-cream p-4 dark:bg-zinc-800">
        <h3 className="font-mono text-base font-bold">{election.title}</h3>
        <p className="font-mono text-xs uppercase text-gray-600 dark:text-zinc-400">
          Draft — closes {new Date(election.end_time).toLocaleString()}
        </p>
      </div>

      <div className="neu-border flex flex-col gap-3 bg-white p-4 dark:bg-zinc-900">
        <h4 className="font-mono text-sm font-bold uppercase">Add a candidate</h4>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="Candidate name"
            className="neu-border flex-1 bg-white p-2 font-mono text-sm outline-none dark:bg-zinc-800"
          />
          <input
            type="text"
            value={candidateBio}
            onChange={(e) => setCandidateBio(e.target.value)}
            placeholder="Short bio (optional)"
            className="neu-border flex-1 bg-white p-2 font-mono text-sm outline-none dark:bg-zinc-800"
          />
          <Button
            type="button"
            variant="outline"
            disabled={addingCandidate || !candidateName.trim()}
            onClick={handleAddCandidate}
          >
            <Plus size={14} /> Add
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {candidates.map((candidate) => (
          <div key={candidate.id} className="flex flex-col gap-2">
            <div className="neu-border flex items-center justify-between gap-2 bg-white p-3 dark:bg-zinc-900">
              <div>
                <p className="font-mono text-sm font-bold">{candidate.name}</p>
                {candidate.bio && (
                  <p className="font-mono text-xs text-gray-600 dark:text-zinc-400">{candidate.bio}</p>
                )}
              </div>
              {/* No remove button once other admins/candidates may already be mid-upload;
                  removal can be added later via a dedicated RPC if needed. */}
            </div>
            <CandidateManifestoUpload
              electionId={election.id}
              candidate={candidate}
              onUploaded={() => refreshCandidates(election.id)}
            />
          </div>
        ))}
        {candidates.length === 0 && (
          <p className="neu-border bg-white p-4 text-center font-mono text-xs text-gray-500 dark:bg-zinc-900">
            No candidates yet — add at least two to open voting.
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="primary"
        disabled={opening || candidates.length < 2}
        onClick={handleOpenElection}
      >
        <PlayCircle size={16} /> {opening ? "Opening…" : "Open voting"}
      </Button>
    </div>
  );
}
