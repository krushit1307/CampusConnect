import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

export default function KioskMode() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputBuffer = useRef("");
  const lastKeyTime = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if focus is in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const currentTime = Date.now();

      // If time between keystrokes is too long (e.g., > 100ms), it's probably a human typing, reset buffer
      if (currentTime - lastKeyTime.current > 100) {
        inputBuffer.current = "";
      }
      lastKeyTime.current = currentTime;

      if (e.key === "Enter") {
        e.preventDefault();
        const scannedId = inputBuffer.current.trim();
        inputBuffer.current = "";

        if (scannedId.length >= 5) {
          // Assuming student IDs are at least 5 chars
          await handleScan(scannedId);
        }
        return;
      }

      // Add to buffer if it's a character
      if (e.key.length === 1) {
        inputBuffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [eventId]);

  const handleScan = async (studentId: string) => {
    try {
      // 1. Find user by student_id_number
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("student_id_number", studentId)
        .single();

      if (userError || !user) {
        showStatus("error", "NOT REGISTERED");
        return;
      }

      // 2. Update RSVP
      const { data: rsvp, error: rsvpError } = await supabase
        .from("event_rsvps")
        .update({ checked_in: true })
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (rsvpError || !rsvp) {
        showStatus("error", "NOT REGISTERED");
        return;
      }

      showStatus("success", `SUCCESS - ${user.full_name}`);
    } catch (error) {
      console.error(error);
      showStatus("error", "SYSTEM ERROR");
    }
  };

  const showStatus = (newStatus: "success" | "error", msg: string) => {
    setStatus(newStatus);
    setMessage(msg);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setStatus("idle");
      setMessage("");
    }, 2000);
  };

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center p-8 transition-colors duration-300 ${
        status === "success" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-black"
      }`}
    >
      <button
        onClick={() => navigate(-1)}
        className="absolute top-8 left-8 text-white/50 hover:text-white flex items-center gap-2 font-mono"
      >
        <ArrowLeft className="w-5 h-5" />
        Exit Kiosk Mode
      </button>

      <div className="text-center text-white">
        {status === "idle" && (
          <div className="flex flex-col items-center animate-pulse">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">READY TO SCAN</h1>
            <p className="font-mono text-white/70">Scan a student ID barcode to check in</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center">
            <CheckCircle className="w-32 h-32 mb-8" />
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4">
              {message.split(" - ")[0]}
            </h1>
            <p className="text-3xl md:text-5xl font-mono opacity-90">{message.split(" - ")[1]}</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center">
            <XCircle className="w-32 h-32 mb-8" />
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4">{message}</h1>
            <p className="font-mono text-white/70 text-xl">
              Please check registration or scan again
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
