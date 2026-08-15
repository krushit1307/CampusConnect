import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Delete from "lucide-react/dist/esm/icons/delete";

export default function WatchLogin() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const supabase = createClient();

  // Check if already paired
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = localStorage.getItem("watch_session_token");
      if (storedToken) {
        const { error } = await supabase.auth.setSession({
          access_token: storedToken,
          refresh_token: "",
        });
        if (!error) {
          navigate("/watch/dashboard");
        } else {
          localStorage.removeItem("watch_session_token");
        }
      }
    };
    checkSession();
  }, [navigate, supabase]);

  const handleKeyPress = (num: string) => {
    if (code.length < 4) {
      setCode((prev) => prev + num);
    }
  };

  const handleClear = () => {
    setCode((prev) => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (code.length !== 4) {
      toast.error("Enter a 4-digit code");
      return;
    }

    try {
      setLoading(true);
      const { data: token, error } = await supabase.rpc("verify_watch_pairing", {
        p_pairing_code: code,
      });

      if (error) throw error;

      // Pair session on client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: "",
      });

      if (sessionError) throw sessionError;

      localStorage.setItem("watch_session_token", token);
      toast.success("Watch Paired!");
      navigate("/watch/dashboard");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Pairing failed");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ width: "100vw", height: "100vh", margin: 0, padding: 0 }}
      className="flex flex-col items-center justify-center bg-black text-cream overflow-hidden select-none font-mono"
    >
      <div className="flex flex-col items-center justify-between w-full h-full max-w-[240px] max-h-[240px] p-2 box-border">
        {/* Title / Header */}
        <div className="text-[10px] uppercase font-bold tracking-wider text-lime">
          {loading ? "Pairing..." : "Enter Pair Code"}
        </div>

        {/* Code Slots */}
        <div className="flex gap-1.5 my-1">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-6 h-8 border-2 flex items-center justify-center text-sm font-extrabold rounded ${
                code[idx]
                  ? "border-lime bg-lime/10 text-lime"
                  : "border-brand-gray-base-800 text-brand-gray-base-600"
              }`}
            >
              {code[idx] ?? "-"}
            </div>
          ))}
        </div>

        {/* Watch Optimized Keypad */}
        <div className="grid grid-cols-3 gap-1 w-full max-w-[180px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="h-6 bg-brand-gray-base-900 border border-brand-gray-base-800 rounded font-bold text-xs hover:bg-brand-gray-base-800 active:bg-lime active:text-black flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-6 bg-red-950/40 border border-red-900 text-red-400 rounded font-bold text-xs active:bg-red-500 active:text-black flex items-center justify-center"
            aria-label="Delete"
          >
            <Delete size={12} />
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="h-6 bg-brand-gray-base-900 border border-brand-gray-base-800 rounded font-bold text-xs hover:bg-brand-gray-base-800 active:bg-lime active:text-black flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="h-6 bg-lime/20 border border-lime text-lime rounded font-bold text-[10px] uppercase active:bg-lime active:text-black flex items-center justify-center disabled:opacity-50"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
