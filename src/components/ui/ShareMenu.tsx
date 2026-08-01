import { useState } from "react";
import { Share2, Copy, Check, MessageCircle, Twitter, Linkedin } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWebShare } from "@/hooks/useWebShare";

interface ShareMenuProps {
  url: string;
  title: string;
  text?: string;
  children?: React.ReactNode;
}

export function ShareMenu({ url, title, text, children }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const webShare = useWebShare();
  const [localCopied, setLocalCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const shareText = text || `Check out: ${title}`;
  const encodedShareText = encodeURIComponent(shareText);

  const handleShareClick = async (e: React.MouseEvent) => {
    if (webShare.canShare) {
      e.preventDefault();
      const result = await webShare.share({ title, text: shareText, url });
      switch (result.kind) {
        case "success":
          toast.success("Shared successfully!");
          break;
        case "error":
          toast.error("Error sharing.");
          setOpen(true);
          break;
        case "unavailable":
          setOpen(true);
          break;
      }
    }
  };

  const handleCopyLink = async () => {
    const ok = await webShare.copyToClipboard(url);
    if (ok) {
      setLocalCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setLocalCopied(false), 2000);
    } else {
      toast.error("Failed to copy link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={handleShareClick}>
        {children || (
          <Button
            variant="outline"
            className="neu-border neu-press inline-flex items-center gap-2 bg-white px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-cream"
            aria-label={`Share ${title}`}
          >
            <Share2 aria-hidden="true" size={14} strokeWidth={3} />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="neu-border bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl font-black uppercase text-black">
            Share Event
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            variant="outline"
            className="neu-border neu-press w-full justify-start gap-3 bg-white px-4 py-6 font-mono text-sm font-bold uppercase transition-colors hover:bg-cream"
            onClick={handleCopyLink}
          >
            {localCopied ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
            {localCopied ? "Link Copied!" : "Copy Link"}
          </Button>

          <Button
            asChild
            variant="outline"
            className="neu-border neu-press w-full justify-start gap-3 bg-white px-4 py-6 font-mono text-sm font-bold uppercase transition-colors hover:bg-brand-social-whatsapp hover:text-white group"
          >
            <a
              href={`https://wa.me/?text=${encodedShareText}%20${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-5 w-5 group-hover:text-white" />
              WhatsApp
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            className="neu-border neu-press w-full justify-start gap-3 bg-white px-4 py-6 font-mono text-sm font-bold uppercase transition-colors hover:bg-brand-social-twitter hover:text-white group"
          >
            <a
              href={`https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Twitter className="h-5 w-5 group-hover:text-white" />
              Twitter/X
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            className="neu-border neu-press w-full justify-start gap-3 bg-white px-4 py-6 font-mono text-sm font-bold uppercase transition-colors hover:bg-brand-social-linkedin hover:text-white group"
          >
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin className="h-5 w-5 group-hover:text-white" />
              LinkedIn
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
