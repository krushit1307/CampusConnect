import React from 'react';
import { TextbookOffer } from '../../../backend/src/models/CampusTextbookModel';
import { BookOpen, DollarSign, CheckCircle2, Clock, XCircle, Tag, MessageSquare } from 'lucide-react';

interface ActivityTimelineProps {
  offers: TextbookOffer[];
  onDecision: (offerId: string, status: 'accepted' | 'declined') => void;
}

export const TextbookActivityTimeline: React.FC<ActivityTimelineProps> = ({
  offers,
  onDecision,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">My Textbook Purchase Offers</h3>
          <p className="text-sm text-gray-500">Track pending and accepted offers for peer textbook exchanges</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">
          {offers.length} Active Offers
        </span>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No textbook offers submitted yet</p>
          <p className="text-xs text-gray-400 mt-1">Browse active textbook listings above to send price offers to peer sellers.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100/60 text-indigo-700 mt-0.5">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">{offer.bookTitle}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {offer.createdDate}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-gray-700 font-medium">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                      "{offer.message}"
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Price */}
              <div className="flex items-center justify-between md:justify-end gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-0.5 font-extrabold text-gray-900 text-lg">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>{offer.offeredPrice}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {offer.status === 'accepted' && (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Offer Accepted
                      </span>
                    )}
                    {offer.status === 'pending' && (
                      <span className="text-amber-600 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Pending Response
                      </span>
                    )}
                    {offer.status === 'declined' && (
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Offer Declined
                      </span>
                    )}
                  </div>
                </div>

                {offer.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onDecision(offer.id, 'accepted')}
                      className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onDecision(offer.id, 'declined')}
                      className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
