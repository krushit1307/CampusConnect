import React from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface ReferralLinkGeneratorProps {
  referralCode: string;
}

export const ReferralLinkGenerator: React.FC<ReferralLinkGeneratorProps> = ({ referralCode }) => {
  const [copied, setCopied] = React.useState(false);
  const referralUrl = `${window.location.origin}/auth?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="neu-border p-6 bg-yellow-100 flex flex-col gap-4">
      <div>
        <h3 className="font-black text-xl mb-1 uppercase tracking-wider">Your Referral Link</h3>
        <p className="text-gray-700">
          Share this link to earn 500 Gamification Points when your friends attend their first
          event!
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          readOnly
          value={referralUrl}
          className="neu-border flex-1 px-4 py-2 bg-white font-mono text-sm text-gray-600 focus:outline-none"
        />
        <button
          onClick={handleCopy}
          className="neu-border neu-press px-6 py-2 bg-black text-white font-bold flex items-center justify-center gap-2"
        >
          {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
};
