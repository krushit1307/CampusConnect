// src/components/ClubMembershipCard.jsx

import React from 'react';

export default function ClubMembershipCard({ tier, clubId, onSubscribe }) {
    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 flex flex-col justify-between transition-transform hover:-translate-y-1">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">{tier.tier_name}</h3>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-sm font-semibold">
                ${tier.price}/semester
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-6">{tier.benefits}</p>
          </div>
          
          <button
            onClick={() => onSubscribe(tier.id, clubId)}
            className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Join {tier.tier_name}
          </button>
        </div>
    );
}
