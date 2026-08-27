import React from "react";
import { useCrisisAbTest } from "@/hooks/useCrisisAbTest";
import { AlertTriangle, Phone, MessageCircle } from "lucide-react";

export function CrisisAbTestBanner({ sessionId }: { sessionId: string }) {
  const { variant, trackConversion, loading } = useCrisisAbTest(sessionId);

  if (loading || !variant) return null;

  const handleCtaClick = () => {
    void trackConversion();
    window.location.href = variant.url;
  };

  return (
    <div className={`p-4 border-l-8 neu-border neu-shadow flex items-center justify-between my-6 ${
      variant.color === 'red' ? 'bg-red-50 border-red-500' : 'bg-blue-50 border-blue-500'
    }`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className={`p-3 rounded-full ${variant.color === 'red' ? 'bg-red-200' : 'bg-blue-200'}`}>
          <AlertTriangle className={`w-6 h-6 ${variant.color === 'red' ? 'text-red-700' : 'text-blue-700'}`} />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold uppercase">{variant.title}</h3>
          <p className="font-mono text-sm text-gray-700">{variant.copy}</p>
        </div>
      </div>
      <button 
        onClick={handleCtaClick}
        className={`mt-4 sm:mt-0 font-mono font-bold px-6 py-3 uppercase border-2 border-black flex items-center gap-2 ${
          variant.color === 'red' ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-blue-600 text-white hover:bg-blue-500'
        }`}
      >
        {variant.url.startsWith('tel:') ? <Phone className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
        {variant.cta}
      </button>
    </div>
  );
}
