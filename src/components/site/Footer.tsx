import { Sparkle } from "./Sparkle";

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
            className="inline-block transition-transform duration-200 hover:scale-110 "
          >
            GitHub
          </a>
          <a href="#" className="inline-block transition-transform duration-200 hover:scale-110 ">
            Docs
          </a>
          <a href="#" className="inline-block transition-transform duration-200 hover:scale-110 ">
            Discord
          </a>
          <a href="mailto:support@campusconnect.com" className="hover:underline">
            Contact Us
          </a>
        </div>
      </div>
    </footer>
  );
}
