import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { createClient } from "@/lib/supabase/client";
import Check from "lucide-react/dist/esm/icons/check";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Shield from "lucide-react/dist/esm/icons/shield";

// ABI for DonationEscrow contract
const DONATION_ESCROW_ABI = [
  "function createEscrow(address _recipient, address _oracle, uint256 _amount, uint256 _milestoneDate) external returns (uint256)",
  "function verifyMilestone(uint256 _escrowId) external",
  "function revertDonation(uint256 _escrowId) external",
  "function escrows(uint256) external view returns (address donor, address recipient, address oracle, uint256 amount, uint256 milestoneDate, bool isVerified, bool isResolved)",
];

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Localhost deployment default address
const USDC_ABI = ["function approve(address spender, uint256 amount) returns (bool)"];
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

interface EscrowDonationWidgetProps {
  clubId: string;
  clubWalletAddress: string;
  userRole: "donor" | "club" | "admin";
}

interface EscrowRecord {
  id: string;
  donor_id: string;
  recipient_club_id: string;
  escrow_id: number;
  amount: number;
  milestone_date: string;
  proof_video_url: string | null;
  status: "pending" | "video_submitted" | "verified" | "reverted";
}

export function EscrowDonationWidget({
  clubId,
  clubWalletAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  userRole,
}: EscrowDonationWidgetProps) {
  const [account, setAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState("1000");
  const [milestoneDays, setMilestoneDays] = useState("90");
  const [proofVideo, setProofVideo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [escrows, setEscrows] = useState<EscrowRecord[]>([]);

  const fetchEscrows = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("escrow_donations")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setEscrows(data);
  };

  useEffect(() => {
    fetchEscrows();
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
    } else {
      alert("Please install MetaMask!");
    }
  };

  const handleLockDonation = async () => {
    if (!account) return alert("Please connect wallet first!");
    setIsLoading(true);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Approve USDC
      const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
      const parsedAmount = ethers.utils.parseUnits(amount, 6);
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, parsedAmount);
      await approveTx.wait();

      // Create Escrow in Smart Contract
      const contract = new ethers.Contract(CONTRACT_ADDRESS, DONATION_ESCROW_ABI, signer);
      const milestoneTimestamp =
        Math.floor(Date.now() / 1000) + Number(milestoneDays) * 24 * 60 * 60;
      const oracleAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Simulated Local Admin Address

      const tx = await contract.createEscrow(
        clubWalletAddress,
        oracleAddress,
        parsedAmount,
        milestoneTimestamp,
      );
      const receipt = await tx.wait();

      // Parse escrowId from logs or simulated counter
      const escrowId = escrows.length; // Fallback mapping

      // Save to Database
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("escrow_donations").insert({
        donor_id: user?.id,
        recipient_club_id: clubId,
        escrow_id: escrowId,
        amount: Number(amount),
        milestone_date: new Date(milestoneTimestamp * 1000).toISOString(),
        status: "pending",
      });

      alert("Donation locked in Escrow Contract!");
      fetchEscrows();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to deploy escrow transaction.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitProof = async (id: string) => {
    if (!proofVideo) return alert("Enter proof video URL first!");
    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase
        .from("escrow_donations")
        .update({ proof_video_url: proofVideo, status: "video_submitted" })
        .eq("id", id);
      alert("Proof video submitted for verification!");
      setProofVideo("");
      fetchEscrows();
    } catch (err) {
      alert("Submission failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (record: EscrowRecord) => {
    setIsLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, DONATION_ESCROW_ABI, signer);

      const tx = await contract.verifyMilestone(record.escrow_id);
      await tx.wait();

      const supabase = createClient();
      await supabase.from("escrow_donations").update({ status: "verified" }).eq("id", record.id);

      alert("Milestone verified! Funds released to club.");
      fetchEscrows();
    } catch (err: any) {
      alert(err.message || "Verification transaction failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevert = async (record: EscrowRecord) => {
    setIsLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, DONATION_ESCROW_ABI, signer);

      const tx = await contract.revertDonation(record.escrow_id);
      await tx.wait();

      const supabase = createClient();
      await supabase.from("escrow_donations").update({ status: "reverted" }).eq("id", record.id);

      alert("Donation reverted directly to donor wallet.");
      fetchEscrows();
    } catch (err: any) {
      alert(err.message || "Revert transaction failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="escrow-donation-widget"
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono text-xs my-6"
    >
      <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2 mb-4">
        <Shield className="text-indigo-600" size={18} />
        Verified Escrow Milestone Donations (Web3)
      </h3>

      {!account ? (
        <button
          onClick={connectWallet}
          data-testid="connect-wallet-btn"
          className="border-2 border-black bg-yellow-300 px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000] hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000] transition-all"
        >
          🦊 Connect MetaMask
        </button>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-100 p-2.5 border-2 border-black inline-block text-[10px]">
            Connected: <strong>{account}</strong>
          </div>

          {userRole === "donor" && (
            <div className="border-t-2 border-black pt-4 space-y-4">
              <h4 className="font-bold uppercase">Lock New Milestone Donation</h4>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <label>Amount (USDC)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="border-2 border-black px-2 py-1.5 w-32"
                    data-testid="donation-amount-input"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label>Milestone Period (Days)</label>
                  <input
                    type="number"
                    value={milestoneDays}
                    onChange={(e) => setMilestoneDays(e.target.value)}
                    className="border-2 border-black px-2 py-1.5 w-32"
                    data-testid="milestone-days-input"
                  />
                </div>
              </div>
              <button
                onClick={handleLockDonation}
                disabled={isLoading}
                data-testid="lock-donation-btn"
                className="border-2 border-black bg-[#a3e635] px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000]"
              >
                {isLoading ? "Processing..." : "Deploy Escrow & Lock Funds"}
              </button>
            </div>
          )}

          {/* Active Escrows list */}
          <div className="border-t-2 border-black pt-4">
            <h4 className="font-bold uppercase mb-3">Milestone Progress Tracking</h4>
            <div className="space-y-4">
              {escrows.map((record) => {
                const deadlinePassed = new Date(record.milestone_date).getTime() < Date.now();
                return (
                  <div
                    key={record.id}
                    data-testid={`escrow-record-${record.id}`}
                    className="border-2 border-black p-4 bg-slate-50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        Escrow #{record.escrow_id} — <strong>{record.amount} USDC</strong>
                      </span>
                      <span
                        className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                          record.status === "verified"
                            ? "bg-green-100 text-green-700 border-green-600"
                            : record.status === "reverted"
                              ? "bg-red-100 text-red-700 border-red-600"
                              : "bg-yellow-100 text-yellow-700 border-yellow-600"
                        }`}
                      >
                        {record.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-gray-600">
                      Milestone Deadline: {new Date(record.milestone_date).toLocaleString()}
                    </div>

                    {/* Proof Video section */}
                    {record.proof_video_url ? (
                      <div className="bg-white border-2 border-black p-2 text-[10px]">
                        📺 Proof Video:{" "}
                        <a
                          href={record.proof_video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 underline"
                        >
                          {record.proof_video_url}
                        </a>
                      </div>
                    ) : (
                      userRole === "club" &&
                      record.status === "pending" && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="YouTube Proof Video URL"
                            value={proofVideo}
                            onChange={(e) => setProofVideo(e.target.value)}
                            className="border-2 border-black px-2 py-1 w-full"
                            data-testid={`proof-video-input-${record.id}`}
                          />
                          <button
                            onClick={() => handleSubmitProof(record.id)}
                            className="border-2 border-black bg-yellow-300 px-3 py-1 font-bold uppercase"
                          >
                            Submit Proof
                          </button>
                        </div>
                      )
                    )}

                    {/* Actions */}
                    {userRole === "admin" &&
                      record.status === "video_submitted" &&
                      !deadlinePassed && (
                        <button
                          onClick={() => handleVerify(record)}
                          data-testid={`verify-btn-${record.id}`}
                          className="border-2 border-black bg-[#a3e635] px-3 py-1 font-bold uppercase"
                        >
                          Verify & Release Funds
                        </button>
                      )}

                    {/* Revert if deadline passed and not resolved */}
                    {deadlinePassed &&
                      record.status !== "verified" &&
                      record.status !== "reverted" && (
                        <div className="flex items-center justify-between bg-red-50 p-2.5 border border-red-300">
                          <span className="text-red-700 font-bold flex items-center gap-1.5">
                            <AlertCircle size={14} /> Deadline Expired without verification!
                          </span>
                          <button
                            onClick={() => handleRevert(record)}
                            data-testid={`revert-btn-${record.id}`}
                            className="border-2 border-red-700 bg-red-100 text-red-700 px-3 py-1 font-bold uppercase hover:bg-red-200"
                          >
                            Execute Auto-Revert
                          </button>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
