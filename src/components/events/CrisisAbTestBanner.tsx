import React, { useState } from "react";
import { useCrisisAbTest } from "@/hooks/useCrisisAbTest";
import { AlertTriangle, Phone, MessageCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { matchPeerResponder } from "@/lib/liveSupportChat";

export function CrisisAbTestBanner({ sessionId }: { sessionId: string }) {
  const { variant, trackConversion, loading: abLoading } = useCrisisAbTest(sessionId);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const navigate = useNavigate();

  if (abLoading || !variant) return null;

  const isOffHours = () => {
    const hour = new Date().getHours();
    return hour < 8 || hour >= 17;
  };

  const handleCtaClick = async () => {
    void trackConversion();

    if (isOffHours()) {
      setIsMatchmaking(true);
      try {
        const matchmakingResult = await matchPeerResponder();

        if (matchmakingResult.matched && matchmakingResult.roomId) {
          navigate(`/chat/secure/${matchmakingResult.roomId}`);
          return;
        }
      } catch (error) {
        console.error("Peer matchmaking failed. Falling back to default resources:", error);
      } finally {
        setIsMatchmaking(false);
      }
    }

    window.location.href = variant.url;
  };

  return (
    <div
      className={`p-4 border-l-8 neu-border neu-shadow flex items-center justify-between my-6 ${
        variant.color === "red" ? "bg-red-50 border-red-500" : "bg-blue-50 border-blue-500"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div
          className={`p-3 rounded-full ${variant.color === "red" ? "bg-red-200" : "bg-blue-200"}`}
        >
          <AlertTriangle
            className={`w-6 h-6 ${variant.color === "red" ? "text-red-700" : "text-blue-700"}`}
          />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold uppercase">{variant.title}</h3>
          <p className="font-mono text-sm text-gray-700">{variant.copy}</p>
        </div>
      </div>
      <button
        onClick={handleCtaClick}
        disabled={isMatchmaking}
        className={`mt-4 sm:mt-0 font-mono font-bold px-6 py-3 uppercase border-2 border-black flex items-center gap-2 transition-all ${
          variant.color === "red"
            ? "bg-red-600 text-white hover:bg-red-500"
            : "bg-blue-600 text-white hover:bg-blue-500"
        } disabled:opacity-70 disabled:cursor-not-allowed`}
      >
        {isMatchmaking ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : variant.url.startsWith("tel:") ? (
          <Phone className="w-4 h-4" />
        ) : (
          <MessageCircle className="w-4 h-4" />
        )}
        {isMatchmaking ? "Connecting..." : variant.cta}
      </button>
    </div>
  );
}
