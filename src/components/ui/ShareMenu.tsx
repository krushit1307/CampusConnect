import { Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ShareMenuProps {
  url: string;
  title: string;
  text?: string;
}

export function ShareMenu({ url, title, text }: ShareMenuProps) {
  const encodedUrl = encodeURIComponent(url);
  const shareText = text || `Check out: ${title}`;
  const encodedShareText = encodeURIComponent(shareText);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="neu-border neu-press inline-flex items-center gap-2 bg-white px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-cream"
        aria-label={`Share ${title}`}
      >
        <Share2 aria-hidden="true" size={14} strokeWidth={3} />
        Share
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="neu-border bg-white">
        <DropdownMenuItem asChild>
          <a
            href={`https://wa.me/?text=${encodedShareText}%20${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer font-mono text-xs font-bold uppercase hover:bg-brand-social-whatsapp hover:text-white"
          >
            WhatsApp
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer font-mono text-xs font-bold uppercase hover:bg-brand-social-twitter hover:text-white"
          >
            Twitter/X
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer font-mono text-xs font-bold uppercase hover:bg-brand-social-linkedin hover:text-white"
          >
            LinkedIn
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
