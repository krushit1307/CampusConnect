// =============================================================================
// Component: PoapTrophyCase
// Purpose: Displays earned Proof-of-Attendance Protocol (POAP) NFTs on 
//   a 3D-styled wooden trophy shelf with hover tilts and Gnosis Chain transaction links.
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { PoapService, type PoapClaim } from "@/services/poapService";
import { Button } from "@/components/ui/button";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import Cpu from "lucide-react/dist/esm/icons/cpu";
import X from "lucide-react/dist/esm/icons/x";

interface PoapTrophyCaseProps {
  userId: string;
  isOwnProfile: boolean;
}

export function PoapTrophyCase({ userId, isOwnProfile }: PoapTrophyCaseProps) {
  const [claims, setClaims] = useState<PoapClaim[]>([]);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [editWalletInput, setEditWalletInput] = useState<string>("");
  const [showWalletForm, setShowWalletForm] = useState<boolean>(false);
  const [selectedClaim, setSelectedClaim] = useState<PoapClaim | null>(null);
  const [processingWorker, setProcessingWorker] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    // 1. Fetch user's POAP claims
    const userClaims = await PoapService.fetchUserClaims(userId);
    setClaims(userClaims);

    // 2. Fetch profile wallet address
    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", userId)
      .single();

    if (profile?.wallet_address) {
      setWalletAddress(profile.wallet_address);
      setEditWalletInput(profile.wallet_address);
    }
  }, [userId]);

  useEffect(() => {
    void loadData();
  }, [userId, loadData]);

  // Realtime claims synchronization
  useEffect(() => {
    const channel = supabase
      .channel(`poap-claims-realtime-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poap_claims",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, loadData]);

  const handleSaveWallet = async () => {
    try {
      const ok = await PoapService.saveWalletAddress(userId, editWalletInput);
      if (ok) {
        setWalletAddress(editWalletInput);
        setShowWalletForm(false);
        toast.success("Web3 wallet address successfully linked!");
        void loadData();
      } else {
        toast.error("Failed to link wallet. Ensure the format matches 0x...");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update wallet.");
    }
  };

  const handleRunWorker = async () => {
    setProcessingWorker(true);
    toast.info("Triggering SQS Background NFT Minting worker...");
    try {
      const count = await PoapService.runSimulatedWorker();
      if (count > 0) {
        toast.success(`Successfully processed ${count} pending POAP NFT claims!`);
        void loadData();
      } else {
        toast.info("No pending POAP claims found in queue.");
      }
    } catch (err: any) {
      toast.error(err.message || "Worker processing error");
    } finally {
      setProcessingWorker(false);
    }
  };

  return (
    <div
      className="border-4 border-black bg-cream p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] rounded-none text-black font-mono relative overflow-hidden"
      data-testid="poap-trophy-case"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-black pb-3 mb-6">
        <h3 className="flex items-center gap-2 text-2xl font-black uppercase text-black">
          <Trophy className="h-6 w-6 text-black animate-bounce" /> Verified 3D Trophy Case
        </h3>
        <div className="flex gap-2">
          {/* Worker Simulation Tool */}
          {isOwnProfile && (
            <Button
              onClick={handleRunWorker}
              disabled={processingWorker}
              className="neu-border neu-press bg-black text-lime font-mono text-[10px] font-bold uppercase px-3 py-1.5 flex items-center gap-1.5"
              data-testid="run-poap-worker-btn"
            >
              <Cpu className="h-3.5 w-3.5" /> Mint Queue Worker (Sim)
            </Button>
          )}
        </div>
      </div>

      {/* Wallet Management Block */}
      {isOwnProfile && (
        <div className="border-2 border-black bg-purple-50 p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-black" />
            <div>
              <span className="font-black text-xs uppercase block text-purple-900">Web3 Wallet Address</span>
              <span className="text-[10px] text-zinc-600 block truncate max-w-md">
                {walletAddress ? walletAddress : "No wallet linked. Syncing checked-in badges requires a linked address."}
              </span>
            </div>
          </div>
          {showWalletForm ? (
            <div className="flex gap-2 items-center w-full sm:w-auto">
              <input
                type="text"
                placeholder="0x..."
                value={editWalletInput}
                onChange={(e) => setEditWalletInput(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1 text-xs font-mono outline-none flex-1 text-black"
                data-testid="wallet-input"
              />
              <Button
                onClick={handleSaveWallet}
                className="neu-border bg-lime text-black font-mono text-[10px] font-bold uppercase px-3 py-1"
                data-testid="save-wallet-btn"
              >
                Save
              </Button>
              <Button
                onClick={() => setShowWalletForm(false)}
                className="neu-border bg-red-100 text-black font-mono text-[10px] font-bold px-3 py-1"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowWalletForm(true)}
              className="neu-border neu-press bg-white text-black font-mono text-[10px] font-bold uppercase px-4 py-2 border-2 border-black"
              data-testid="edit-wallet-btn"
            >
              {walletAddress ? "Change Wallet" : "Link Web3 Wallet"}
            </Button>
          )}
        </div>
      )}

      {/* Wood Trophy Shelf (3D Perspective container) */}
      <div className="relative mt-8 py-8 px-4 bg-orange-100/10 border-2 border-black/10 min-h-[220px]">
        {claims.length === 0 ? (
          <div className="text-center text-zinc-500 text-xs py-10 font-bold border-2 border-dashed border-zinc-400">
            Trophy Shelf is Empty. Verify event check-ins to collect badges.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-y-12 gap-x-4">
            {claims.map((claim) => {
              const badge = claim.poap_events;
              if (!badge) return null;
              return (
                <div
                  key={claim.id}
                  onClick={() => setSelectedClaim(claim)}
                  className="flex flex-col items-center cursor-pointer group relative"
                  data-testid={`trophy-badge-${badge.poap_id}`}
                >
                  {/* Glowing 3D Coin Badge */}
                  <div
                    className="relative w-16 h-16 rounded-full border-3 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-yellow-300 flex items-center justify-center transition-all duration-300 transform group-hover:scale-110 group-hover:-translate-y-2 group-hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] group-hover:rotate-6 rotate-0"
                    style={{ perspective: "1000px" }}
                  >
                    <img
                      src={badge.badge_image_url}
                      alt={badge.badge_title}
                      className="w-12 h-12 object-contain rounded-full"
                    />
                  </div>
                  <span className="text-[9px] font-black text-center text-black uppercase mt-3 leading-tight block w-20 truncate">
                    {badge.badge_title}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 3D Polished Wood Plank Shelf base using CSS styling */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-amber-950 border-t-2 border-b-2 border-black shadow-[0px_4px_6px_rgba(0,0,0,0.4)] transform skew-x-3 origin-bottom"></div>
        <div className="absolute bottom-[-10px] left-0 right-0 h-3 bg-amber-900 border-b-2 border-black transform skew-x-[-1deg]"></div>
      </div>

      {/* Claim Detail Modal */}
      {selectedClaim && selectedClaim.poap_events && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border-4 border-black bg-yellow-300 p-6 max-w-md w-full shadow-[8px_8px_0px_rgba(0,0,0,1)] font-mono text-black relative">
            <button
              onClick={() => setSelectedClaim(null)}
              className="absolute top-3 right-3 border-2 border-black bg-white p-1 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 border-b-2 border-black pb-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-black" />
              <h4 className="font-display font-black text-sm uppercase">Verified Credential Info</h4>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] bg-white flex items-center justify-center">
                <img
                  src={selectedClaim.poap_events.badge_image_url}
                  alt={selectedClaim.poap_events.badge_title}
                  className="w-16 h-16 object-contain rounded-full"
                />
              </div>

              <div className="w-full space-y-2 text-xs">
                <div className="flex justify-between border-b border-black/10 py-1">
                  <span className="font-bold text-zinc-600">Badge Title:</span>
                  <span className="font-black text-right">{selectedClaim.poap_events.badge_title}</span>
                </div>
                <div className="flex justify-between border-b border-black/10 py-1">
                  <span className="font-bold text-zinc-600">POAP Event ID:</span>
                  <span className="font-black">{selectedClaim.poap_events.poap_id}</span>
                </div>
                <div className="flex justify-between border-b border-black/10 py-1">
                  <span className="font-bold text-zinc-600">Token ID:</span>
                  <span className="font-black">{selectedClaim.token_id || "Mint Pending"}</span>
                </div>
                <div className="flex justify-between border-b border-black/10 py-1">
                  <span className="font-bold text-zinc-600">Gnosis Wallet:</span>
                  <span className="font-mono font-bold truncate max-w-[150px]">{selectedClaim.wallet_address}</span>
                </div>
                {selectedClaim.transaction_hash && (
                  <div className="flex flex-col border-b border-black/10 py-1 gap-1">
                    <span className="font-bold text-zinc-600">Transaction Hash:</span>
                    <a
                      href={`https://gnosisscan.io/tx/${selectedClaim.transaction_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[9px] text-blue-800 underline truncate hover:text-blue-900"
                    >
                      {selectedClaim.transaction_hash}
                    </a>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="font-bold text-zinc-600">Minted Date:</span>
                  <span className="font-black">{new Date(selectedClaim.minted_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
