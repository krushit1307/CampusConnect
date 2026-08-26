import React, { useState } from 'react';
import { TextbookListing } from '../../../backend/src/models/CampusTextbookModel';
import { BookOpen, Star, Tag, FileText, CheckCircle2, ShoppingBag, Clock } from 'lucide-react';

interface TextbookCardProps {
  book: TextbookListing;
  onMakeOfferClick: (book: TextbookListing) => void;
}

export const TextbookListingCard: React.FC<TextbookCardProps> = ({ book, onMakeOfferClick }) => {
  const [copied, setCopied] = useState(false);

  const getConditionColor = (cond: string) => {
    switch (cond) {
      case 'like-new':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'good':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'fair':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-6 flex flex-col justify-between">
      <div>
        {/* Course Code & Price */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg text-xs">
              {book.courseCode}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${getConditionColor(book.condition)}`}>
              {book.condition.replace('-', ' ')}
            </span>
            {book.includesNotes && (
              <span className="bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border border-purple-200">
                <FileText className="w-3 h-3" /> Includes Notes
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-gray-900">${book.price}</span>
          </div>
        </div>

        {/* Title & Author */}
        <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1 line-clamp-2">{book.title}</h3>
        <p className="text-xs text-gray-500 font-medium mb-3">
          By {book.author} • <span className="text-gray-700 font-semibold">{book.edition}</span>
        </p>

        {/* Description */}
        <p className="text-gray-600 text-xs mb-4 line-clamp-2 leading-relaxed">{book.description}</p>

        {/* ISBN & Department */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400 font-medium">ISBN:</span>
            <span className="font-mono text-gray-700 font-semibold">{book.isbn}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400 font-medium">Department:</span>
            <span className="text-gray-700 font-medium">{book.department}</span>
          </div>
        </div>

        {/* Seller Info */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 mb-5">
          <div className="flex items-center gap-2.5">
            <img
              src={book.sellerAvatar}
              alt={book.sellerName}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-50"
            />
            <div>
              <span className="font-semibold text-gray-900 text-xs block">{book.sellerName}</span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-300" /> {book.postedDate}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{book.sellerRating.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onMakeOfferClick(book)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" />
          Make Purchase Offer
        </button>
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          title="Share Listing"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Tag className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
