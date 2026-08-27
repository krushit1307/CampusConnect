import { useEffect, useState } from "react";
import Download from "lucide-react/dist/esm/icons/download";
import X from "lucide-react/dist/esm/icons/x";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Only show if the user has not explicitly dismissed it before
      const isDismissed = localStorage.getItem("pwa_prompt_dismissed") === "true";
      if (!isDismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismissClick = () => {
    // Store in localStorage so we don't badger the user
    localStorage.setItem("pwa_prompt_dismissed", "true");
    setIsVisible(false);
  };

  if (!isVisible || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[110] px-4 pb-6 pt-2 pointer-events-none flex justify-center animate-slide-up">
      <div className="pointer-events-auto w-full max-w-md bg-[#fef8eb] border-3 border-black p-5 shadow-[6px_6px_0_0_#000] rounded-xl flex flex-col gap-4 relative">
        {/* Dismiss Button */}
        <button
          onClick={handleDismissClick}
          aria-label="Dismiss install prompt"
          className="absolute top-3 right-3 text-gray-500 hover:text-black transition-colors"
        >
          <X size={18} className="stroke-[3]" />
        </button>

        {/* Content */}
        <div className="flex gap-4 items-start">
          <div className="w-12 h-12 shrink-0 bg-[#f5c66b] border-2 border-black flex items-center justify-center rounded-xl shadow-[2px_2px_0_0_#000] font-display font-bold text-[#123a57] text-lg">
            CC
          </div>
          <div className="flex flex-col pr-6">
            <h3 className="font-display font-bold text-lg text-black leading-tight">
              Install CampusConnect
            </h3>
            <p className="font-mono text-xs text-gray-700 leading-relaxed mt-1">
              Add CampusConnect to your home screen for faster access, offline support, and a
              premium mobile experience.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleInstallClick}
          className="w-full py-2.5 bg-[#123a57] text-white border-2 border-black font-mono font-bold text-sm uppercase tracking-wider rounded-lg shadow-[3px_3px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#000] transition-all hover:bg-[#1e5c8a]"
        >
          <span className="flex items-center justify-center gap-2">
            <Download size={16} className="stroke-[3]" />
            Add to Home Screen
          </span>
        </button>
      </div>
    </div>
  );
}
