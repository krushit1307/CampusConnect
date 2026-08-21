import React, { useState } from "react";
import {
  Briefcase,
  Plus,
  CheckCircle2,
  DollarSign,
  Calendar,
  FileText,
  ExternalLink,
  Award,
  TrendingDown,
  Building,
  Send,
  Check,
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

export interface VendorRfpManagerProps {
  clubId?: string;
  clubName?: string;
  initialRfps?: VendorRfp[];
  initialBids?: Record<string, RfpBid[]>;
  onRfpCreated?: (rfp: VendorRfp) => void;
  onBidAccepted?: (rfpId: string, bidId: string) => void;
  className?: string;
}

export const MOCK_INITIAL_RFPS: VendorRfp[] = [
  {
    id: "rfp-1",
    club_id: "club-eng-1",
    title: "Catering for 300-Person Annual Gala Banquet",
    category: "catering",
    description: "Need dinner catering with vegetarian and vegan options for 300 guests on Friday evening.",
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
      quoted_price: 1950,
      proposal_pdf_url: "https://cdn.campus.edu/proposals/gourmet.pdf",
      notes: "Three-course buffet with dessert station.",
      status: "pending",
    },
  ],
};

export const VendorRfpManager: React.FC<VendorRfpManagerProps> = ({
  clubId = "club-eng-1",
  clubName = "Engineering Society",
  initialRfps = MOCK_INITIAL_RFPS,
  initialBids = MOCK_INITIAL_BIDS,
  onRfpCreated,
  onBidAccepted,
  className,
}) => {
  const [rfps, setRfps] = useState<VendorRfp[]>(initialRfps);
  const [bidsByRfp, setBidsByRfp] = useState<Record<string, RfpBid[]>>(initialBids);
  const [selectedRfpId, setSelectedRfpId] = useState<string>(rfps[0]?.id || "rfp-1");
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showVendorBidModal, setShowVendorBidModal] = useState<boolean>(false);
  const [awardedNotice, setAwardedNotice] = useState<string | null>(null);

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

  const activeRfp = rfps.find((r) => r.id === selectedRfpId) || rfps[0];
  const activeBids = rankBidsByValue(bidsByRfp[selectedRfpId] || []);

  const handleCreateRfp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const newRfp: VendorRfp = {
      id: `rfp-${Date.now()}`,
      club_id: clubId,
      title: title.trim(),
      category,
      description: description.trim(),
      budget_max: budgetMax,
      deadline: deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      status: "open",
      created_at: new Date().toISOString(),
    };

    const updated = [newRfp, ...rfps];
    setRfps(updated);
    setSelectedRfpId(newRfp.id);
    if (onRfpCreated) onRfpCreated(newRfp);

    // Reset Form
    setTitle("");
    setDescription("");
    setShowCreateModal(false);
  };

  const handleSubmitVendorBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !vendorEmail.trim()) return;

    const newBid: RfpBid = {
      id: `bid-${Date.now()}`,
      rfp_id: selectedRfpId,
      vendor_name: vendorName.trim(),
      vendor_email: vendorEmail.trim(),
      quoted_price: quotedPrice,
      proposal_pdf_url: proposalPdfUrl.trim() || null,
      notes: notes.trim() || null,
      status: "pending",
    };

    const currentBids = bidsByRfp[selectedRfpId] || [];
    const updatedBids = { ...bidsByRfp, [selectedRfpId]: [...currentBids, newBid] };
    setBidsByRfp(updatedBids);

    // Reset Form
    setVendorName("");
    setVendorEmail("");
    setProposalPdfUrl("");
    setNotes("");
    setShowVendorBidModal(false);
  };

  const handleAcceptBid = (bid: RfpBid) => {
    // Transition RFP status to awarded and update winning bid
    const updatedRfps = rfps.map((r) =>
      r.id === selectedRfpId ? { ...r, status: "awarded" as const, accepted_bid_id: bid.id } : r
    );
    setRfps(updatedRfps);

    const currentBids = (bidsByRfp[selectedRfpId] || []).map((b) =>
      b.id === bid.id ? { ...b, status: "accepted" as const } : { ...b, status: "rejected" as const }
    );
    setBidsByRfp({ ...bidsByRfp, [selectedRfpId]: currentBids });

    setAwardedNotice(`Bid awarded to ${bid.vendor_name} for $${bid.quoted_price.toLocaleString()}! Invoice generation workflow initiated.`);
    if (onBidAccepted) onBidAccepted(selectedRfpId, bid.id);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-emerald-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-emerald-950">
            <Briefcase className="w-5 h-5 text-emerald-700" />
            <span>Vendor "Call for Proposals" (RFP) Portal — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Automate event procurement. Broadcast structured requests for food, DJs, and decor to receive competitive vendor bids.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowVendorBidModal(true)}
            className="px-3.5 py-2 border-2 border-black bg-white hover:bg-gray-100 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
          >
            <Send className="w-4 h-4 text-emerald-600" />
            Submit Vendor Quote
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Post New RFP
          </button>
        </div>
      </div>

      {/* Awarded Confirmation Banner */}
      {awardedNotice && (
        <div className="p-3.5 bg-emerald-50 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{awardedNotice}</span>
        </div>
      )}

      {/* Main Grid: RFPs List & Bid Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* RFPs Sidebar */}
        <div className="lg:col-span-1 p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-3 bg-slate-50">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800">
            Active Procurement Jobs ({rfps.length})
          </h4>

          <div className="space-y-2.5">
            {rfps.map((rfp) => {
              const isSelected = rfp.id === selectedRfpId;
              const bidsCount = (bidsByRfp[rfp.id] || []).length;

              return (
                <div
                  key={rfp.id}
                  onClick={() => setSelectedRfpId(rfp.id)}
                  className={cn(
                    "p-3.5 border-2 rounded-lg cursor-pointer transition-all space-y-1.5",
                    isSelected
                      ? "border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ring-1 ring-emerald-400"
                      : "border-gray-300 bg-gray-50/70 hover:border-gray-500"
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
                          : "bg-emerald-100 text-emerald-900 border-emerald-400"
                      )}
                    >
                      {rfp.status}
                    </span>
                  </div>

                  <h5 className="font-bold text-xs text-black">{rfp.title}</h5>

                  <div className="flex items-center justify-between text-[11px] font-sans text-gray-600 pt-1">
                    <span>Budget: <strong>${rfp.budget_max.toLocaleString()}</strong></span>
                    <span>{bidsCount} Bids</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected RFP & Bid Comparison Matrix (#3559) */}
        <div className="lg:col-span-2 p-5 bg-white space-y-5">
          {activeRfp && (
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

                {activeBids.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-xl text-xs text-gray-500">
                    No vendor proposals received yet. Share the public RFP link with local restaurants, DJs, or suppliers.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeBids.map((bid) => {
                      const savings = calculateBidSavings(activeRfp.budget_max, bid.quoted_price);
                      const isAccepted = bid.status === "accepted";

                      return (
                        <div
                          key={bid.id}
                          className={cn(
                            "p-4 border-2 border-black rounded-lg space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                            isAccepted ? "bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400" : "bg-white"
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
                                  savings.isUnderBudget ? "text-emerald-700" : "text-rose-700"
                                )}
                              >
                                {savings.isUnderBudget
                                  ? `Saves $${savings.savingsAmount.toLocaleString()} (${savings.savingsPercent}% under budget)`
                                  : `+$${Math.abs(savings.savingsAmount).toLocaleString()} over budget`}
                              </span>
                            </div>
                          </div>

                          {bid.notes && (
                            <p className="text-xs font-sans text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-200">
                              "{bid.notes}"
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                            {bid.proposal_pdf_url ? (
                              <a
                                href={bid.proposal_pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-purple-700 underline flex items-center gap-1 hover:text-purple-900"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                View Proposal PDF <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-gray-400">No PDF attached</span>
                            )}

                            {activeRfp.status === "open" && (
                              <button
                                type="button"
                                onClick={() => handleAcceptBid(bid)}
                                className="px-3.5 py-1.5 border-2 border-black bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Accept Bid
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create RFP Modal */}
      {showCreateModal && (
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
                  <label htmlFor="rfp-category-select" className="text-xs font-bold uppercase block mb-1">
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
                  <label htmlFor="rfp-budget-input" className="text-xs font-bold uppercase block mb-1">
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
                className="px-4 py-2 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Broadcast RFP to Vendors
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Submit Vendor Bid Modal */}
      {showVendorBidModal && (
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

            <div className="space-y-3">
              <div>
                <label htmlFor="vendor-name-input" className="text-xs font-bold uppercase block mb-1">
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
                  <label htmlFor="vendor-email-input" className="text-xs font-bold uppercase block mb-1">
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
                  <label htmlFor="vendor-quote-input" className="text-xs font-bold uppercase block mb-1">
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
                <label htmlFor="vendor-pdf-input" className="text-xs font-bold uppercase block mb-1">
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
                <label htmlFor="vendor-notes-input" className="text-xs font-bold uppercase block mb-1">
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
                className="px-4 py-2 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Submit Automated Bid
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
