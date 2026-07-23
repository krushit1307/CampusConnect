import { MessageCircle, Share2, Twitter } from "lucide-react";

interface EventSharePanelProps {
  title: string;
}

export default function EventSharePanel({ title }: EventSharePanelProps) {
  const eventUrl = typeof window !== "undefined" ? window.location.href : "";

  const shareText = `Check out ${title}`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}&url=${encodeURIComponent(eventUrl)}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${eventUrl}`)}`;

  const handleShare = async () => {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };

    if (nav.share) {
      await nav.share({
        title,
        text: shareText,
        url: eventUrl,
      });
    }
  };

  const supportsShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="flex items-center gap-2">
      {supportsShare && (
        <button
          onClick={handleShare}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Share event"
        >
          <Share2 size={20} />
        </button>
      )}

      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full p-2 hover:bg-muted"
        aria-label="Share on Twitter"
      >
        <Twitter size={20} />
      </a>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full p-2 hover:bg-muted"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle size={20} />
      </a>
    </div>
  );
}
