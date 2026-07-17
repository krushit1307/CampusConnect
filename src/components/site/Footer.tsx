import { Sparkle } from "./Sparkle";
import { ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t-2 border-black bg-black text-cream">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 md:flex-row md:items-center md:px-6">
        <p className="font-mono text-xs uppercase tracking-widest">
          Built by the CampusConnect community
        </p>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
          <Sparkle size={14} />
          <span>Open-source · MIT · v0.1</span>
          <Sparkle size={14} />
        </div>
        <div className="flex gap-4 font-mono text-xs uppercase tracking-widest">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-transform duration-200 hover:scale-110"
          >
            GitHub
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href="https://github.com/krushit1307/CampusConnect#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-transform duration-200 hover:scale-110"
          >
            Docs
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href="https://discord.gg/BEMjApACe"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-transform duration-200 hover:scale-110"
          >
            Discord
            <ExternalLink className="w-4 h-4" />
          </a>
          {/* Note: mailto links don't usually get external link icons since they open email clients */}
          <a href="mailto:support@campusconnect.com" className="hover:underline">
            Contact Us
          </a>
        </div>
      </div>
    </footer>
  );
}
