/**
 * Election-related Supabase database operations.
 *
 * Security model lives almost entirely in RLS/SQL, not here (see
 * supabase/migrations/20260824000000_create_election_module.sql) — this
 * module just calls it correctly:
 *  - `votes` can never be listed in bulk from the client; the only way to
 *    read outcomes is `getElectionResults`, which queries the
 *    `election_results` view (empty until the election is closed).
 *  - Casting a vote, or setting a manifesto, goes through a normal insert
 *    / an RPC — the database itself rejects anything that shouldn't be
 *    allowed, this layer doesn't duplicate that logic or trust the client.
 *
 * NOTE: `elections`, `candidates`, and `votes` won't appear in
 * `src/types/database.types.ts` until it's regenerated against a database
 * that has the migration applied (`supabase gen types typescript`). The
 * types below are defined by hand in the meantime and should be swapped
 * for the generated `Tables<"...">` equivalents once that's done.
 */

import { supabase } from "./client";
import type { PostgrestError } from "@supabase/supabase-js";

export type ElectionStatus = "draft" | "open" | "closed";

export type Election = {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  created_by: string;
  end_time: string;
  status: ElectionStatus;
  tie_extension_count: number;
  created_at: string;
  updated_at: string;
};

export type Candidate = {
  id: string;
  election_id: string;
  user_id: string | null;
  name: string;
  bio: string | null;
  manifesto_path: string | null;
  manifesto_type: "video" | "pdf" | null;
  ballot_position: number;
  created_at: string;
};

export type ElectionResultRow = {
  election_id: string;
  candidate_id: string;
  candidate_name: string;
  vote_count: number;
};

export type MyVote = {
  election_id: string;
  candidate_id: string;
};

type Result<T> = { data: T | null; error: PostgrestError | Error | unknown };

const MANIFESTO_BUCKET = "election-manifestos";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getClubElections(clubId: string): Promise<Result<Election[]>> {
  try {
    const { data, error } = await supabase
      .from("elections")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { data: data as Election[], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function getElection(electionId: string): Promise<Result<Election>> {
  try {
    const { data, error } = await supabase
      .from("elections")
      .select("*")
      .eq("id", electionId)
      .single();
    if (error) throw error;
    return { data: data as Election, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function getCandidates(electionId: string): Promise<Result<Candidate[]>> {
  try {
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("election_id", electionId)
      .order("ballot_position", { ascending: true });
    if (error) throw error;
    return { data: data as Candidate[], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Returns the current member's own cast vote for this election, or `null`
 * if they haven't voted yet. This never reveals anyone else's vote — the
 * RLS policy on `votes` only ever lets a user SELECT their own row.
 */
export async function getMyVote(electionId: string): Promise<Result<MyVote | null>> {
  try {
    const { data, error } = await supabase
      .from("votes")
      .select("election_id, candidate_id")
      .eq("election_id", electionId)
      .maybeSingle();
    if (error) throw error;
    return { data: data as MyVote | null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Aggregate results for an election. Returns an EMPTY array (not an
 * error) whenever results aren't available yet — either the election
 * hasn't closed, or the deadline hasn't passed. That's the
 * `election_results` view's WHERE clause doing its job, not a bug: check
 * `election.status` / `election.end_time` separately if the UI needs to
 * explain *why* nothing is showing yet.
 */
export async function getElectionResults(electionId: string): Promise<Result<ElectionResultRow[]>> {
  try {
    const { data, error } = await supabase
      .from("election_results")
      .select("*")
      .eq("election_id", electionId)
      .order("vote_count", { ascending: false });
    if (error) throw error;
    return { data: data as ElectionResultRow[], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createElection(input: {
  clubId: string;
  title: string;
  description?: string;
  endTime: Date;
}): Promise<Result<Election>> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw userError ?? new Error("Not signed in.");

    const { data, error } = await supabase
      .from("elections")
      .insert({
        club_id: input.clubId,
        title: input.title,
        description: input.description ?? null,
        created_by: userData.user.id,
        end_time: input.endTime.toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return { data: data as Election, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Only works while the election is still a draft — enforced by RLS, not here. */
export async function addCandidate(input: {
  electionId: string;
  name: string;
  bio?: string;
  userId?: string;
  ballotPosition?: number;
}): Promise<Result<Candidate>> {
  try {
    // If candidate has a user ID, verify no Conflict of Interest exists
    if (input.userId) {
      const { data: electionData } = await supabase
        .from("elections")
        .select("club_id, title")
        .eq("id", input.electionId)
        .maybeSingle();

      if (electionData?.club_id) {
        const { data: coiCheck } = await supabase.rpc(
          "verify_candidate_conflict_of_interest",
          {
            p_club_id: electionData.club_id,
            p_candidate_user_id: input.userId,
            p_position: electionData.title || "Executive",
          }
        );

        if (coiCheck?.has_conflict) {
          throw new Error(
            coiCheck.message ||
              `You cannot run for this position while holding an executive role in ${coiCheck.conflicting_club || "another club"}.`
          );
        }
      }
    }

    const { data, error } = await supabase
      .from("candidates")
      .insert({
        election_id: input.electionId,
        name: input.name,
        bio: input.bio ?? null,
        user_id: input.userId ?? null,
        ballot_position: input.ballotPosition ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { data: data as Candidate, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Transitions an election from 'draft' to 'open'. Only permitted by RLS while still draft. */
export async function openElection(electionId: string): Promise<Result<Election>> {
  try {
    const { data, error } = await supabase
      .from("elections")
      .update({ status: "open" })
      .eq("id", electionId)
      .select("*")
      .single();
    if (error) throw error;
    return { data: data as Election, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Casts exactly one vote. A second call for the same election will fail
 * with a unique-constraint violation (election_id, user_id) — that's the
 * database itself enforcing "one vote per member," not a client-side check.
 */
export async function castVote(electionId: string, candidateId: string): Promise<Result<void>> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw userError ?? new Error("Not signed in.");

    const { error } = await supabase.from("votes").insert({
      election_id: electionId,
      candidate_id: candidateId,
      user_id: userData.user.id,
    });
    if (error) throw error;
    return { data: undefined, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// ---------------------------------------------------------------------------
// Anonymous Voting (Issue #3928 — Decentralized Club Voting)
// ---------------------------------------------------------------------------

export type AnonymousVoteReceipt = {
  election_id: string;
  receipt_hash: string;
  created_at: string;
};

export type AnonymousResultRow = {
  election_id: string;
  candidate_id: string;
  candidate_name: string;
  vote_count: number;
};

/**
 * Cast an anonymous vote via the cast_vote_anonymous RPC.
 * Returns the receipt_hash — a sha256(user_id + election_id + salt) that
 * proves the voter participated without revealing their identity.
 * The actual ballot is stored in election_ballots (no user_id column).
 */
export async function castAnonymousVote(
  electionId: string,
  candidateId: string,
): Promise<Result<string>> {
  try {
    const { data, error } = await supabase.rpc("cast_vote_anonymous", {
      p_election_id: electionId,
      p_candidate_id: candidateId,
    });
    if (error) throw error;
    return { data: data as string, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Verify that a receipt_hash belongs to a valid vote in this election.
 * The voter can confirm their ballot was counted — but never which
 * candidate they chose (the ballot table has no user_id).
 */
export async function verifyReceipt(
  electionId: string,
  receiptHash: string,
): Promise<Result<boolean>> {
  try {
    const { data, error } = await supabase.rpc("verify_vote_receipt", {
      p_election_id: electionId,
      p_receipt_hash: receiptHash,
    });
    if (error) throw error;
    return { data: data as boolean, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Fetch anonymous aggregate results from the anonymous_election_results view.
 * Returns EMPTY (not an error) until the election closes and end_time passes.
 */
export async function getAnonymousResults(
  electionId: string,
): Promise<Result<AnonymousResultRow[]>> {
  try {
    const { data, error } = await supabase
      .from("anonymous_election_results")
      .select("*")
      .eq("election_id", electionId)
      .order("vote_count", { ascending: false });
    if (error) throw error;
    return { data: data as AnonymousResultRow[], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Uploads a candidate's manifesto file to private storage, then records
 * it on the candidate row via the `set_candidate_manifesto` RPC (which
 * checks server-side that the caller IS this candidate, and that the
 * election is still a draft — see the migration for why this is an RPC
 * rather than a plain UPDATE).
 */
export async function uploadCandidateManifesto(input: {
  electionId: string;
  candidateId: string;
  file: File;
  manifestoType: "video" | "pdf";
}): Promise<Result<void>> {
  try {
    const fallbackExtension = input.manifestoType === "pdf" ? "pdf" : "mp4";
    const extension = input.file.name.split(".").pop() || fallbackExtension;
    const path = `${input.electionId}/${input.candidateId}/manifesto.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(MANIFESTO_BUCKET)
      .upload(path, input.file, { upsert: true });
    if (uploadError) throw uploadError;

    const { error: rpcError } = await supabase.rpc("set_candidate_manifesto", {
      p_candidate_id: input.candidateId,
      p_manifesto_path: path,
      p_manifesto_type: input.manifestoType,
    });
    if (rpcError) throw rpcError;

    return { data: undefined, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Signed, time-limited URL for viewing a candidate's manifesto (private bucket). */
export async function getManifestoUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<Result<string>> {
  try {
    const { data, error } = await supabase.storage
      .from(MANIFESTO_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error) throw error;
    return { data: data.signedUrl, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
