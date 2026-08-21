import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { useChatStore } from "@/store/useChatStore";

export default function ChatHeader({ onResetKeys }: { onResetKeys: () => void }) {
  const initializingKeys = useChatStore((s) => s.initializingKeys);

  return (
    <div className="mb-6 border-2 border-black bg-[#ffde00] p-4 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-wider sm:text-3xl">
            Secure Direct Messages
          </h1>
          <p className="mt-1 font-mono text-xs font-semibold uppercase">
            End-to-End Encrypted (E2EE) Client-Side Cryptography (ECDH + AES-GCM 256)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onResetKeys}
            disabled={initializingKeys}
            className="neu-border flex items-center gap-1 bg-white px-3 py-1 font-mono text-xs font-bold uppercase text-black transition-all hover:bg-black hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={12} className={initializingKeys ? "animate-spin" : ""} />
            Reset Keys
          </button>
          <span className="flex items-center gap-1 border-2 border-black bg-lime px-3 py-1 font-mono text-xs font-bold uppercase text-black">
            <ShieldCheck size={14} />
            E2EE Secure
          </span>
        </div>
      </div>
    </div>
  );
}
