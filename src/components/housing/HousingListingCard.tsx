import React, { useState } from 'react';
import { HousingListing } from '../../../backend/src/models/CampusHousingModel';
import { Home, MapPin, DollarSign, Calendar, CheckCircle2, ShieldCheck, Mail, Wifi, Sparkles } from 'lucide-react';

interface HousingCardProps {
  listing: HousingListing;
  onInquireClick: (listing: HousingListing) => void;
}

export const HousingListingCard: React.FC<HousingCardProps> = ({ listing, onInquireClick }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between">
      <div>
        {/* Cover Image */}
        <div className="relative h-48 w-full overflow-hidden bg-gray-100">
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-gray-900 font-bold px-2.5 py-1 rounded-lg text-xs shadow">
            {listing.leaseTerm}
          </div>
          <div className="absolute top-3 right-3 bg-indigo-600 text-white font-black px-3 py-1 rounded-xl text-sm shadow">
            ${listing.monthlyRent}/mo
          </div>
        </div>

        <div className="p-6">
          {/* Header & Location */}
          <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>{listing.distanceToCampus}</span>
            <span>•</span>
            <span className="capitalize">{listing.propertyType.replace('-', ' ')}</span>
          </div>

          <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1 line-clamp-2">{listing.title}</h3>
          <p className="text-xs text-gray-500 font-medium mb-3">{listing.address}</p>

          {/* Description */}
          <p className="text-gray-600 text-xs mb-4 line-clamp-2 leading-relaxed">{listing.description}</p>

          {/* Amenities Badges */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {listing.amenities.map((amenity, idx) => (
              <span key={idx} className="bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5 rounded-full font-medium">
                {amenity}
              </span>
            ))}
          </div>

          {/* Lister Profile info */}
          <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={listing.listerAvatar}
                alt={listing.listerName}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-50"
              />
              <div>
                <span className="font-semibold text-gray-900 text-xs block">{listing.listerName}</span>
                <span className="text-[11px] text-gray-400">{listing.listerRole}</span>
              </div>
            </div>
            {listing.isVerifiedStudent && (
              <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Student Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-6 pt-0 flex items-center gap-3">
        <button
          onClick={() => onInquireClick(listing)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4" />
          Send Sublease Inquiry
        </button>
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          title="Share Listing"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Home className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
