import React, { useState } from "react";
import {
  Briefcase,
  Plus,
  FileText,
  ExternalLink,
  Award,
  Building,
  Send,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import {
  VendorRfp,
  RfpBid,
  RfpCategory,
  RFP_CATEGORIES,
  calculateBidSavings,
  rankBidsByValue,
  formatRfpCategoryLabel,
} from "@/lib/vendorRfp";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { VendorPortfolioViewer } from "./VendorPortfolioViewer";
import { VendorW9Form } from "./VendorW9Form";
import { Vendor1099MiscPanel } from "./Vendor1099MiscPanel";

export interface VendorRfpManagerProps {
  clubId?: string;
  eventId?: string;
  clubName?: string;
  isVendorView?: boolean;
  className?: string;
}

export const MOCK_INITIAL_RFPS: VendorRfp[] = [
  {
    id: "rfp-1",
    club_id: "club-eng-1",
    title: "Catering for 300-Person Annual Gala Banquet",
    category: "catering",
    description:
      "Need dinner catering with vegetarian and vegan options for 300 guests on Friday evening.",
    budget_max: 2000,
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: "open",
    created_at: new Date().toISOString(),
  },
];

export const MOCK_INITIAL_BIDS: Record<string, RfpBid[]> = {
  "rfp-1": [
    {
      id: "bid-1",
      rfp_id: "rfp-1",
      vendor_name: "TacoCorp Catering",
      vendor_email: "events@tacocorp.com",
      quoted_price: 1650,
      proposal_pdf_url: "https://cdn.campus.edu/proposals/tacocorp.pdf",
      notes: "Includes taco bar setup, server staff, and biodegradable plates.",
      status: "pending",
    },
    {
      id: "bid-2",
      rfp_id: "rfp-1",
      vendor_name: "Gourmet Banquet Pros",
      vendor_email: "sales@gourmetpros.com",
      quoted_price: 2500, // Set high to test counter-offer
      proposal_pdf_url: "https://cdn.campus.edu/proposals/gourmet.pdf",
      notes: "Three-course buffet with dessert station.",
      status: "pending",
    },
  ],
};

export const VendorRfpManager: React.FC<VendorRfpManagerProps> = ({
  clubId,
  eventId,
  clubName = "CampusConnect",
  isVendorView = false,
  className,
}) => {
  const [supabase] = useState(() => createClient());
  const queryClient = useQueryClient();

  const [selectedRfpId, setSelectedRfpId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showVendorBidModal, setShowVendorBidModal] = useState<boolean>(false);
  const [portfolioBid, setPortfolioBid] = useState<RfpBid | null>(null);

  // New RFP Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<RfpCategory>("catering");
  const [description, setDescription] = useState("");
  const [budgetMax, setBudgetMax] = useState<number>(1500);
  const [deadline, setDeadline] = useState<string>("");

  // Vendor Submit Bid Form State
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [quotedPrice, setQuotedPrice] = useState<number>(1200);
  const [proposalPdfUrl, setProposalPdfUrl] = useState("");
  const [notes, setNotes] = useState("");

  const { data: rfps = [], isLoading: isLoadingRfps } = useQuery({
    queryKey: ["vendor_rfps", clubId, eventId],
    queryFn: async () => {
      let q = supabase.from("vendor_rfps").select("*").order("created_at", { ascending: false });
      if (clubId) q = q.eq("club_id", clubId);
      if (eventId) q = q.eq("event_id", eventId);
      if (isVendorView) q = q.eq("status", "open");
      const { data, error } = await q;
      if (error) throw error;
      return data as VendorRfp[];
    },
  });

  const { data: bids = [], isLoading: isLoadingBids } = useQuery({
    queryKey: ["rfp_bids", selectedRfpId],
    queryFn: async () => {
      if (!selectedRfpId) return [];
      const { data, error } = await supabase
        .from("rfp_bids")
        .select("*")
        .eq("rfp_id", selectedRfpId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RfpBid[];
    },
    enabled: !!selectedRfpId,
  });

  const { data: requiresW9 } = useQuery({
    queryKey: ["vendor_requires_w9_to_bid"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendor_requires_w9_to_bid");
      if (error) throw error;
      return data === true;
    },
    enabled: isVendorView,
  });
  const biddingFrozen = requiresW9 === true;

  // Ensure selectedRfpId is valid or set it to first RFP
  React.useEffect(() => {
    if (rfps.length > 0 && !selectedRfpId) {
      setSelectedRfpId(rfps[0].id);
    } else if (rfps.length > 0 && selectedRfpId) {
      const exists = rfps.some((r) => r.id === selectedRfpId);
      if (!exists) setSelectedRfpId(rfps[0].id);
    }
  }, [rfps, selectedRfpId]);
  // 🔥 Counter-Offer State Machine 🔥
  const [counterBidTarget, setCounterBidTarget] = useState<RfpBid | null>(null);
  const [counterPrice, setCounterPrice] = useState<number>(0);
  const [counterMessage, setCounterMessage] = useState("");

  const activeRfp = rfps.find((r) => r.id === selectedRfpId) || rfps[0];
  const activeBids = rankBidsByValue(bids);

  const createRfpMutation = useMutation({
    mutationFn: async (newRfp: any) => {
      const { data, error } = await supabase.from("vendor_rfps").insert(newRfp).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("RFP Posted Successfully!");
      queryClient.invalidateQueries({ queryKey: ["vendor_rfps"] });
      setSelectedRfpId(data.id);
      setTitle("");
      setDescription("");
      setShowCreateModal(false);
    },
    onError: (error: any) => toast.error(error.message || "Failed to create RFP"),
  });

  const submitBidMutation = useMutation({
    mutationFn: async (newBid: any) => {
      const { data, error } = await supabase.rpc("submit_vendor_rfp_bid", {
        p_rfp_id: newBid.rfp_id,
        p_vendor_name: newBid.vendor_name,
        p_vendor_email: newBid.vendor_email,
        p_quoted_price: newBid.quoted_price,
        p_proposal_pdf_url: newBid.proposal_pdf_url,
        p_notes: newBid.notes,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Vendor Bid Submitted!");
      queryClient.invalidateQueries({ queryKey: ["rfp_bids", selectedRfpId] });
      setVendorName("");
      setVendorEmail("");
      setProposalPdfUrl("");
      setNotes("");
      setShowVendorBidModal(false);
    },
    onError: (error: any) => toast.error(error.message || "Failed to submit bid"),
  });

  const acceptBidMutation = useMutation({
    mutationFn: async ({
      rfpId,
      bidId,
      amount,
      vendorUserId,
      vendorName,
    }: {
      rfpId: string;
      bidId: string;
      amount: number;
      vendorUserId?: string | null;
      vendorName: string;
    }) => {
      const { error: rfpError } = await supabase
        .from("vendor_rfps")
        .update({ status: "awarded", accepted_bid_id: bidId })
        .eq("id", rfpId)
        .eq("status", "open"); // Prevent multiple accepts
      if (rfpError) throw rfpError;

      const { error: acceptError } = await supabase
        .from("rfp_bids")
        .update({ status: "accepted" })
        .eq("id", bidId);
      if (acceptError) throw acceptError;

      const { error: rejectError } = await supabase
        .from("rfp_bids")
        .update({ status: "rejected" })
        .eq("rfp_id", rfpId)
        .neq("id", bidId);
      if (rejectError) throw rejectError;

      const escrowClubId = clubId || rfps.find((r) => r.id === rfpId)?.club_id;
      if (escrowClubId) {
        const expiration = new Date();
        expiration.setUTCFullYear(expiration.getUTCFullYear() + 1);
        const { error: escrowError } = await supabase.from("vendor_contracts").insert({
          club_id: escrowClubId,
          vendor_id: vendorUserId || null,
          vendor_name: vendorName,
          amount,
          escrow_locked_at: new Date().toISOString(),
          expiration_date: expiration.toISOString().slice(0, 10),
        });
        if (escrowError) throw escrowError;
      }
    },
    onSuccess: () => {
      toast.success(`Bid accepted! Escrow payment workflow initiated.`);
      queryClient.invalidateQueries({ queryKey: ["vendor_rfps"] });
      queryClient.invalidateQueries({ queryKey: ["rfp_bids", selectedRfpId] });
    },
    onError: (error: any) => toast.error(error.message || "Failed to accept bid"),
  });

  const handleCreateRfp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (budgetMax <= 0) {
      toast.error("Budget must be greater than 0");
      return;
    }

    createRfpMutation.mutate({
      club_id: clubId,
      event_id: eventId || null,
      title: title.trim(),
      category,
      description: description.trim(),
      budget_max: budgetMax,
      deadline: deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
  };

  const handleSubmitVendorBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !vendorEmail.trim()) return;
    if (quotedPrice <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }
    if (activeRfp?.status !== "open") {
      toast.error("This RFP is no longer open for bids.");
      return;
    }
    if (quotedPrice > activeRfp.budget_max) {
      toast.error("Your bid exceeds the maximum budget. Please adjust your quote.");
      return;
    }
    if (biddingFrozen) {
      toast.error(
        "W-9 required: Total_Paid is at least $600 for this fiscal year. Submit a digital W-9 before bidding on new gigs.",
      );
      return;
    }

    submitBidMutation.mutate({
      rfp_id: selectedRfpId,
      vendor_name: vendorName.trim(),
      vendor_email: vendorEmail.trim(),
      quoted_price: quotedPrice,
      proposal_pdf_url: proposalPdfUrl.trim() || null,
      notes: notes.trim() || null,
    });
  };

  const handleAcceptBid = (bid: RfpBid) => {
    if (window.confirm(`Are you sure you want to accept this bid for $${bid.quoted_price}?`)) {
      acceptBidMutation.mutate({
        rfpId: selectedRfpId!,
        bidId: bid.id,
        amount: bid.quoted_price,
        vendorUserId: bid.vendor_user_id,
        vendorName: bid.vendor_name,
      });
    }
  };

  const handleRejectBid = async (bid: RfpBid) => {
    const { error } = await supabase
      .from("rfp_bids")
      .update({ status: "rejected" })
      .eq("id", bid.id);
    if (error) {
      toast.error(error.message || "Failed to reject bid");
      return;
    }
    toast.success(`Bid from ${bid.vendor_name} rejected.`);
    queryClient.invalidateQueries({ queryKey: ["rfp_bids", selectedRfpId] });
  };

  const handleOpenCounterOffer = (bid: RfpBid) => {
    setCounterBidTarget(bid);
    setCounterPrice(bid.quoted_price);
  };

  const submitCounterOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterBidTarget || counterPrice <= 0 || !counterMessage.trim()) return;

    const { error } = await supabase
      .from("rfp_bids")
      .update({ quoted_price: counterPrice, notes: `[Counter-Offer]: ${counterMessage.trim()}` })
      .eq("id", counterBidTarget.id);
    if (error) {
      toast.error(error.message || "Failed to send counter-offer");
      return;
    }
    toast.success(`Counter-offer sent to ${counterBidTarget.vendor_name}.`);
    queryClient.invalidateQueries({ queryKey: ["rfp_bids", selectedRfpId] });
    setCounterBidTarget(null);
    setCounterMessage("");
  };

  if (isLoadingRfps) {
    return (
      <div className="flex h-[300px] items-center justify-center border-2 border-black rounded-xl bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className,
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-emerald-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-emerald-950">
            <Briefcase className="w-5 h-5 text-emerald-700" />
            <span>Vendor "Call for Proposals" (RFP) Portal {clubName && `— ${clubName}`}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Automate event procurement. Broadcast structured requests for food, DJs, and decor to
            receive competitive vendor bids.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isVendorView ? (
            <button
              type="button"
              disabled={!activeRfp || activeRfp.status !== "open" || biddingFrozen}
              onClick={() => setShowVendorBidModal(true)}
              className="px-3.5 py-2 border-2 border-black bg-white hover:bg-gray-100 disabled:opacity-50 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
            >
              <Send className="w-4 h-4 text-emerald-600" />
              {biddingFrozen ? "W-9 Required to Bid" : "Submit Vendor Quote"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Post New RFP
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: RFPs List & Bid Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* RFPs Sidebar */}
        <div className="lg:col-span-1 p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-3 bg-slate-50 min-h-[400px]">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800">
            Active Procurement Jobs ({rfps.length})
          </h4>

          {rfps.length === 0 ? (
            <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500">
              No RFPs found.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {rfps.map((rfp) => {
                const isSelected = rfp.id === selectedRfpId;
                const bidsCount = rfp.id === selectedRfpId ? bids.length : 0;

                return (
                  <div
                    key={rfp.id}
                    onClick={() => setSelectedRfpId(rfp.id)}
                    className={cn(
                      "p-3.5 border-2 rounded-lg cursor-pointer transition-all space-y-1.5",
                      isSelected
                        ? "border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ring-1 ring-emerald-400"
                        : "border-gray-300 bg-gray-50/70 hover:border-gray-500",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                        {formatRfpCategoryLabel(rfp.category)}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border",
                          rfp.status === "awarded"
                            ? "bg-purple-100 text-purple-900 border-purple-400"
                            : rfp.status === "closed"
                              ? "bg-gray-200 text-gray-800 border-gray-400"
                              : "bg-emerald-100 text-emerald-900 border-emerald-400",
                        )}
                      >
                        {rfp.status}
                      </span>
                    </div>

                    <h5 className="font-bold text-xs text-black">{rfp.title}</h5>

                    <div className="flex items-center justify-between text-[11px] font-sans text-gray-600 pt-1">
                      <span>
                        Budget: <strong>${rfp.budget_max.toLocaleString()}</strong>
                      </span>
                      <span>{bidsCount} Bids</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected RFP & Bid Comparison Matrix */}
        <div className="lg:col-span-2 p-5 bg-white space-y-5">
          {activeRfp ? (
            <>
              {/* Selected RFP Details Card */}
              <div className="p-4 border-2 border-black rounded-lg bg-emerald-50/50 space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-black/10 pb-2">
                  <div>
                    <h3 className="font-bold text-sm text-black">{activeRfp.title}</h3>
                    <span className="text-xs font-sans text-gray-600">
                      Category: {formatRfpCategoryLabel(activeRfp.category)}
                    </span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-bold text-emerald-900 block">
                      Max Budget: ${activeRfp.budget_max.toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-xs font-sans text-gray-700">{activeRfp.description}</p>
              </div>

              {/* Submitted Bids Comparison Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-600" />
                    Submitted Vendor Proposals ({activeBids.length})
                  </h4>
                  <span className="text-[11px] font-sans text-gray-500">Sorted by best value</span>
                </div>

                {isLoadingBids ? (
                  <div className="p-8 text-center text-xs text-gray-500 animate-pulse">
                    Loading bids...
                  </div>
                ) : activeBids.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-xl text-xs text-gray-500">
                    No vendor proposals received yet.{" "}
                    {isVendorView
                      ? "Be the first to bid!"
                      : "Share the public RFP link with local restaurants, DJs, or suppliers."}
                    No vendor proposals received yet. Share the public RFP link with local
                    restaurants, DJs, or suppliers.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeBids.map((bid) => {
                      const savings = calculateBidSavings(activeRfp.budget_max, bid.quoted_price);
                      const isAccepted = bid.status === "accepted";
                      const isRejected = bid.status === "rejected";
                      const isPendingReview = (bid.status as any) === "pending_vendor_review";

                      return (
                        <div
                          key={bid.id}
                          className={cn(
                            "p-4 border-2 border-black rounded-lg space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                            isAccepted
                              ? "bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400"
                              : isRejected
                                ? "bg-gray-100 opacity-70"
                                : "bg-white",
                          )}
                        >
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-bold text-sm text-black">{bid.vendor_name}</h5>
                                {isAccepted && (
                                  <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold text-[10px] rounded-full uppercase">
                                    Winning Bid
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="px-2 py-0.5 bg-gray-500 text-white font-bold text-[10px] rounded-full uppercase">
                                    Rejected
                                  </span>
                                )}
                                {isPendingReview && (
                                  <span className="px-2 py-0.5 bg-amber-500 text-white font-bold text-[10px] rounded-full uppercase">
                                    Counter-Offer Pending
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-sans text-gray-500">{bid.vendor_email}</p>
                            </div>

                            <div className="text-left sm:text-right">
                              <div className="font-black text-base text-black">
                                ${bid.quoted_price.toLocaleString()}
                              </div>
                              <span
                                className={cn(
                                  "text-[11px] font-bold",
                                  savings.isUnderBudget ? "text-emerald-700" : "text-rose-700",
                                )}
                              >
                                {savings.isUnderBudget
                                  ? `Saves $${savings.savingsAmount.toLocaleString()} (${savings.savingsPercent}% under budget)`
                                  : `+$${Math.abs(savings.savingsAmount).toLocaleString()} over budget`}
                              </span>
                            </div>
                          </div>

                          {bid.notes && (
                            <p className="text-xs font-sans text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-200 whitespace-pre-wrap">
                              {bid.notes}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setPortfolioBid(bid)}
                                className="px-3 py-1.5 border-2 border-black bg-yellow-300 hover:bg-yellow-400 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                              >
                                View Portfolio
                              </button>
                              {bid.proposal_pdf_url && (
                                <a
                                  href={bid.proposal_pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold text-purple-700 underline flex items-center gap-1 hover:text-purple-900 ml-2"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Proposal PDF <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>

                            {/* 🔥 Negotiation Workflow Buttons 🔥 */}
                            {activeRfp.status === "open" && bid.status === "pending" && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRejectBid(bid)}
                                  className="px-2.5 py-1.5 border-2 border-black bg-white hover:bg-red-50 text-red-600 font-bold text-xs uppercase rounded-md flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCounterOffer(bid)}
                                  className="px-2.5 py-1.5 border-2 border-black bg-amber-300 hover:bg-amber-400 text-amber-900 font-bold text-xs uppercase rounded-md flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" /> Counter-Offer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAcceptBid(bid)}
                                  className="px-3.5 py-1.5 border-2 border-black bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Accept
                                </button>
                              </div>
                            )}

                            {activeRfp.status === "open" && isPendingReview && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-600 font-bold animate-pulse">
                                  Waiting on Vendor...
                                </span>
                                {/* Developer Simulate Button to demonstrate step 5 of the issue */}
                                <button
                                  type="button"
                                  onClick={() => handleAcceptBid(bid)}
                                  className="px-2 py-1 bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold rounded uppercase hover:bg-amber-200"
                                >
                                  Simulate DJ Accept
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[300px] text-xs text-gray-500">
              Select an RFP to view details and bids.
            </div>
          )}
        </div>
      </div>

      {/* 🔥 Counter-Offer Modal 🔥 */}
      {counterBidTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={submitCounterOffer}
            className="bg-white border-2 border-black rounded-xl max-w-lg w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] font-mono"
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-base uppercase flex items-center gap-2 text-amber-600">
                <RefreshCw className="w-5 h-5" />
                Draft Counter-Offer
              </h3>
              <button
                type="button"
                onClick={() => setCounterBidTarget(null)}
                className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                Negotiating with <strong>{counterBidTarget.vendor_name}</strong>. Their original bid
                was <strong>${counterBidTarget.quoted_price}</strong>.
              </div>

              <div>
                <label
                  htmlFor="counter-price-input"
                  className="text-xs font-bold uppercase block mb-1"
                >
                  Your New Offer Amount ($) *
                </label>
                <input
                  id="counter-price-input"
                  type="number"
                  required
                  min={1}
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-sm font-bold bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="counter-message-input"
                  className="text-xs font-bold uppercase block mb-1"
                >
                  Message to Vendor *
                </label>
                <textarea
                  id="counter-message-input"
                  required
                  rows={3}
                  placeholder="e.g., Our budget is tight, can you do $400 without the dessert station?"
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t-2 border-black/10">
              <button
                type="submit"
                className="px-4 py-2 border-2 border-black bg-amber-400 text-black font-bold text-xs uppercase rounded-md hover:bg-amber-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Send Counter-Offer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create RFP Modal */}
      {showCreateModal && !isVendorView && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateRfp}
            className="bg-white border-2 border-black rounded-xl max-w-xl w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] overflow-auto font-mono"
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-base uppercase flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                Post Procurement RFP
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="rfp-title-input" className="text-xs font-bold uppercase block mb-1">
                  Procurement Job Title *
                </label>
                <input
                  id="rfp-title-input"
                  type="text"
                  required
                  placeholder="e.g. 300 Tacos & Catering for Friday Banquet"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rfp-category-select"
                    className="text-xs font-bold uppercase block mb-1"
                  >
                    Category *
                  </label>
                  <select
                    id="rfp-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as RfpCategory)}
                    className="w-full px-3 py-2 border-2 border-black rounded-md text-xs bg-white font-sans"
                  >
                    {RFP_CATEGORIES.map((c) => (
                      <option key={c.category} value={c.category}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="rfp-budget-input"
                    className="text-xs font-bold uppercase block mb-1"
                  >
                    Maximum Budget ($) *
                  </label>
                  <input
                    id="rfp-budget-input"
                    type="number"
                    required
                    min={50}
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-black rounded-md text-xs bg-white font-sans"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rfp-desc-input" className="text-xs font-bold uppercase block mb-1">
                  Requirements & Specifications *
                </label>
                <textarea
                  id="rfp-desc-input"
                  required
                  rows={3}
                  placeholder="Provide details on headcount, dietaries, date, setup times..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t-2 border-black/10">
              <button
                type="submit"
                disabled={createRfpMutation.isPending}
                className="px-4 py-2 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
              >
                {createRfpMutation.isPending ? "Posting..." : "Broadcast RFP to Vendors"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Submit Vendor Bid Modal */}
      {showVendorBidModal && activeRfp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitVendorBid}
            className="bg-white border-2 border-black rounded-xl max-w-xl w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] overflow-auto font-mono"
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-base uppercase flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-600" />
                Submit Vendor Quote
              </h3>
              <button
                type="button"
                onClick={() => setShowVendorBidModal(false)}
                className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
              >
                Close
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-lg text-xs font-sans">
              <span className="font-bold uppercase text-emerald-800">Bidding on:</span>{" "}
              {activeRfp.title} (Max Budget: ${activeRfp.budget_max})
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="vendor-name-input"
                  className="text-xs font-bold uppercase block mb-1"
                >
                  Vendor / Business Name *
                </label>
                <input
                  id="vendor-name-input"
                  type="text"
                  required
                  placeholder="e.g. TacoCorp Catering LLC"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="vendor-email-input"
                    className="text-xs font-bold uppercase block mb-1"
                  >
                    Contact Email *
                  </label>
                  <input
                    id="vendor-email-input"
                    type="email"
                    required
                    placeholder="orders@vendor.com"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="vendor-quote-input"
                    className="text-xs font-bold uppercase block mb-1"
                  >
                    Total Quoted Price ($) *
                  </label>
                  <input
                    id="vendor-quote-input"
                    type="number"
                    required
                    min={1}
                    value={quotedPrice}
                    onChange={(e) => setQuotedPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="vendor-pdf-input"
                  className="text-xs font-bold uppercase block mb-1"
                >
                  Proposal PDF URL (Optional)
                </label>
                <input
                  id="vendor-pdf-input"
                  type="url"
                  placeholder="https://cdn.campus.edu/proposals/quote.pdf"
                  value={proposalPdfUrl}
                  onChange={(e) => setProposalPdfUrl(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="vendor-notes-input"
                  className="text-xs font-bold uppercase block mb-1"
                >
                  Proposal Notes / Inclusions
                </label>
                <textarea
                  id="vendor-notes-input"
                  rows={2}
                  placeholder="Describe portion sizes, delivery timeline, equipment provided..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t-2 border-black/10">
              <button
                type="submit"
                disabled={submitBidMutation.isPending}
                className="px-4 py-2 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
              >
                {submitBidMutation.isPending ? "Submitting..." : "Submit Automated Bid"}
              </button>
            </div>
          </form>
        </div>
      )}
      {isVendorView && (
        <div className="p-5 space-y-4 border-t-2 border-black bg-white">
          {biddingFrozen && (
            <p className="font-mono text-xs font-bold text-red-700">
              Bidding is frozen until you submit a digital W-9. Fiscal-year escrow payouts are at
              least $600.
            </p>
          )}
          <VendorW9Form />
          <Vendor1099MiscPanel isVendorView />
        </div>
      )}
      <VendorPortfolioViewer bid={portfolioBid} onClose={() => setPortfolioBid(null)} />
    </div>
  );
};
