// =============================================================================
// Component: TicketExchangeBoard
// Issue: #3234 - Peer-to-Peer Ticket Swapping Marketplace
// Description: Renders the public P2P Ticket Exchange board allowing users to
// browse, propose, accept, or cancel lateral ticket trades.
// =============================================================================

import React, { useState, useEffect } from "react";
import {
  TicketTradeListing,
  fetchOpenTicketTrades,
  proposeTicketTrade,
  acceptTicketTrade,
  cancelTicketTrade,
} from "../../services/ticketTradeService";

interface UserRSVP {
  id: string;
  event_id: string;
  event_title: string;
  ticket_price: number;
}

interface TicketExchangeBoardProps {
  currentUserId?: string;
  userRsvps?: UserRSVP[];
  availableEvents?: { id: string; title: string; ticket_price: number }[];
  onTradeCompleted?: () => void;
}

export const TicketExchangeBoard: React.FC<TicketExchangeBoardProps> = ({
  currentUserId,
  userRsvps = [],
  availableEvents = [],
  onTradeCompleted,
}) => {
  const [trades, setTrades] = useState<TicketTradeListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Propose Modal State
  const [isProposeOpen, setIsProposeOpen] = useState(false);
  const [selectedOfferRsvpId, setSelectedOfferRsvpId] = useState("");
  const [selectedTargetEventId, setSelectedTargetEventId] = useState("");
  const [proposing, setProposing] = useState(false);

  // Accept Modal State
  const [selectedTradeToAccept, setSelectedTradeToAccept] = useState<TicketTradeListing | null>(
    null,
  );
  const [acceptingRsvpId, setAcceptingRsvpId] = useState("");
  const [accepting, setAccepting] = useState(false);

  const loadTrades = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchOpenTicketTrades();
      setTrades(data);
    } catch (err: any) {
      setErrorMessage("Failed to load trade listings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, []);

  const handleProposeTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferRsvpId || !selectedTargetEventId) {
      setErrorMessage("Please select both a ticket to offer and a target event.");
      return;
    }

    setProposing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await proposeTicketTrade(selectedOfferRsvpId, selectedTargetEventId);
    setProposing(false);

    if (res.success) {
      setSuccessMessage(res.message || "Trade offer published successfully!");
      setIsProposeOpen(false);
      setSelectedOfferRsvpId("");
      setSelectedTargetEventId("");
      loadTrades();
    } else {
      setErrorMessage(res.error || "Failed to submit trade offer.");
    }
  };

  const handleAcceptTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTradeToAccept || !acceptingRsvpId) {
      setErrorMessage("Please select a valid ticket to swap.");
      return;
    }

    setAccepting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await acceptTicketTrade(selectedTradeToAccept.id, acceptingRsvpId);
    setAccepting(false);

    if (res.success) {
      setSuccessMessage(res.message || "Ticket swap executed successfully!");
      setSelectedTradeToAccept(null);
      setAcceptingRsvpId("");
      loadTrades();
      if (onTradeCompleted) onTradeCompleted();
    } else {
      setErrorMessage(res.error || "Failed to accept trade.");
    }
  };

  const handleCancelTrade = async (tradeId: string) => {
    if (!confirm("Are you sure you want to cancel this trade offer?")) return;
    setErrorMessage(null);

    const res = await cancelTicketTrade(tradeId);
    if (res.success) {
      setSuccessMessage("Trade offer cancelled.");
      loadTrades();
    } else {
      setErrorMessage(res.error || "Failed to cancel trade offer.");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-800 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider rounded-full">
              P2P Exchange
            </span>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">
              Ticket Swapping Marketplace
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Exchange your event tickets laterally with fellow students. Equal price verification &
            atomic QR code regeneration guaranteed.
          </p>
        </div>

        <button
          onClick={() => setIsProposeOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition shadow-md flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Propose Trade
        </button>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Trade Board List */}
      <div className="mt-6">
        {loading ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400 animate-pulse">
            Loading active ticket exchange offers...
          </div>
        ) : trades.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
            <svg
              className="w-12 h-12 mx-auto text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              No open ticket trades found.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Be the first to list a ticket trade proposal!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trades.map((trade) => {
              const isOwner = currentUserId && trade.initiator_id === currentUserId;
              const offerPrice = trade.offered_event?.ticket_price ?? 0;
              const requestedPrice = trade.requested_event?.ticket_price ?? 0;

              return (
                <div
                  key={trade.id}
                  className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-5 border border-gray-200 dark:border-gray-700 flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span>Offered by: {trade.initiator_profile?.first_name || "Student"}</span>
                      <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded">
                        {offerPrice === 0 ? "FREE SWAP" : `$${offerPrice / 100} EQUAL TRADE`}
                      </span>
                    </div>

                    {/* Trade Swap Visual */}
                    <div className="grid grid-cols-5 items-center gap-2 my-2">
                      <div className="col-span-2 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                          Has Ticket
                        </p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                          {trade.offered_event?.title || "Offered Event"}
                        </p>
                      </div>

                      <div className="col-span-1 flex items-center justify-center text-indigo-500 font-black">
                        &harr;
                      </div>

                      <div className="col-span-2 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">
                          Wants Ticket
                        </p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                          {trade.requested_event?.title || "Requested Event"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-end gap-2">
                    {isOwner ? (
                      <button
                        onClick={() => handleCancelTrade(trade.id)}
                        className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold hover:bg-red-200 transition"
                      >
                        Cancel Proposal
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedTradeToAccept(trade);
                          setAcceptingRsvpId("");
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow"
                      >
                        Accept Trade
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Propose Trade Modal */}
      {isProposeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Propose Ticket Trade
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Select one of your confirmed tickets to offer, and specify which event ticket you want
              in return.
            </p>

            <form onSubmit={handleProposeTrade} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  1. Your Offered Ticket (RSVP)
                </label>
                <select
                  value={selectedOfferRsvpId}
                  onChange={(e) => setSelectedOfferRsvpId(e.target.value)}
                  required
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">-- Select Your Ticket --</option>
                  {userRsvps.map((rsvp) => (
                    <option key={rsvp.id} value={rsvp.id}>
                      {rsvp.event_title} (
                      {rsvp.ticket_price === 0 ? "Free" : `$${rsvp.ticket_price / 100}`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  2. Requested Event Ticket
                </label>
                <select
                  value={selectedTargetEventId}
                  onChange={(e) => setSelectedTargetEventId(e.target.value)}
                  required
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">-- Select Requested Event --</option>
                  {availableEvents.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title} ({evt.ticket_price === 0 ? "Free" : `$${evt.ticket_price / 100}`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsProposeOpen(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={proposing}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {proposing ? "Submitting..." : "Post Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accept Trade Modal */}
      {selectedTradeToAccept && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Accept Ticket Swap
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              You are swapping for{" "}
              <strong className="text-indigo-600 dark:text-indigo-400">
                {selectedTradeToAccept.offered_event?.title}
              </strong>
              . Select your ticket for{" "}
              <strong className="text-purple-600 dark:text-purple-400">
                {selectedTradeToAccept.requested_event?.title}
              </strong>{" "}
              to complete the trade.
            </p>

            <form onSubmit={handleAcceptTrade} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Select Your Ticket to Trade
                </label>
                <select
                  value={acceptingRsvpId}
                  onChange={(e) => setAcceptingRsvpId(e.target.value)}
                  required
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="">-- Select Your RSVP --</option>
                  {userRsvps
                    .filter((r) => r.event_id === selectedTradeToAccept.requested_event_id)
                    .map((rsvp) => (
                      <option key={rsvp.id} value={rsvp.id}>
                        {rsvp.event_title} Ticket
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedTradeToAccept(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accepting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {accepting ? "Executing Swap..." : "Confirm Swap"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
