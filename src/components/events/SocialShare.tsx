import { useState } from "react";
import { Share2, Copy, Check, Twitter, Send } from "lucide-react";

interface SocialShareProps {
  title: string;
  url?: string;
}

export function SocialShare({ title, url }: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const shareText = `Check out this event: ${title}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const shareToWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} - ${shareUrl}`)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex items-center gap-2 my-4">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1 mr-1">
        <Share2 size={16} /> Share:
      </span>

      {/* WhatsApp Button */}
      <button
        onClick={shareToWhatsApp}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
        title="Share on WhatsApp"
      >
        <Send size={14} /> WhatsApp
      </button>

      {/* Twitter / X Button */}
      <button
        onClick={shareToTwitter}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 transition-colors"
        title="Share on Twitter"
      >
        <Twitter size={14} /> Twitter
      </button>

      {/* Copy Link Button */}
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Copy event link"
      >
        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
