import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

import { useKioskTelemetry } from "@/services/kioskTelemetry";

export default function KioskMode() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputBuffer = useRef("");
  const lastKeyTime = useRef(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [hostCollege, setHostCollege] = useState<string | null>(null);
  const [guestWifiInfo, setGuestWifiInfo] = useState<{
    username: string;
    password: string;
    essid: string;
  } | null>(null);

  useEffect(() => {
    async function fetchHostCollege() {
      if (!eventId) return;
      try {
        const { data: eventData } = await supabase
          .from("events")
          .select("created_by")
          .eq("id", eventId)
          .single();
        if (eventData?.created_by) {
          const { data: creatorProfile } = await supabase
            .from("profiles")
            .select("college")
            .eq("id", eventData.created_by)
            .single();
          if (creatorProfile?.college) {
            setHostCollege(creatorProfile.college);
          }
        }
      } catch (err) {
        console.error("Failed to fetch host college:", err);
      }
    }
    fetchHostCollege();
  }, [eventId]);

  const generateMacAddress = (userId: string) => {
    const clean = userId.replace(/-/g, "");
    const parts = ["02"];
    for (let i = 0; i < 5; i++) {
      parts.push(clean.substring(i * 2, i * 2 + 2) || "00");
    }
    return parts.join(":").toUpperCase();
  };

  // Broadcast real-time hardware telemetry (battery, charging status, ping) every 60s
  useKioskTelemetry("Door 4", eventId);

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
  }, [eventId, hostCollege]);

  const handleScan = async (studentId: string) => {
    try {
      setGuestWifiInfo(null);
      // 1. Find user by student_id_number
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id, full_name, college")
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

      // Check if external guest
      if (user.college && hostCollege && user.college.toLowerCase() !== hostCollege.toLowerCase()) {
        const cleanMac = generateMacAddress(user.id);
        let credentials = {
          username: `${hostCollege.toLowerCase()}_guest_${user.id.substring(0, 4)}`,
          password: Math.random().toString(36).substring(2, 10).toUpperCase(),
          essid: `${hostCollege}-Guest`,
          expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        };

        try {
          // Trigger secure webhook to Cisco ISE mock
          const response = await fetch("https://api.cisco-ise.local/v1/guest-provision", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer cisco-ise-secret-token",
            },
            body: JSON.stringify({
              clientMac: cleanMac,
              fullName: user.full_name,
              guestCollege: user.college,
              hostCollege: hostCollege,
              durationHours: 12,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            credentials = {
              username: data.username || credentials.username,
              password: data.password || credentials.password,
              essid: data.essid || credentials.essid,
              expires_at: data.expires_at || credentials.expires_at,
            };
          }
        } catch (webhookErr) {
          console.error("Cisco ISE Webhook call failed, using fallback:", webhookErr);
        }

        // Save credentials to guest_network_credentials
        await supabase.from("guest_network_credentials").insert({
          rsvp_id: rsvp.id,
          username: credentials.username,
          password: credentials.password,
          essid: credentials.essid,
          expires_at: credentials.expires_at,
        });

        setGuestWifiInfo({
          username: credentials.username,
          password: credentials.password,
          essid: credentials.essid,
        });

        showStatus("success", `SUCCESS - ${user.full_name}`, 10000);
      } else {
        showStatus("success", `SUCCESS - ${user.full_name}`);
      }
    } catch (error) {
      console.error(error);
      showStatus("error", "SYSTEM ERROR");
    }
  };

  const showStatus = (newStatus: "success" | "error", msg: string, duration = 2000) => {
    setStatus(newStatus);
    setMessage(msg);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setStatus("idle");
      setMessage("");
      setGuestWifiInfo(null);
    }, duration);
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

      <div className="text-center text-white w-full max-w-lg flex flex-col items-center">
        {status === "idle" && (
          <div className="flex flex-col items-center animate-pulse">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">READY TO SCAN</h1>
            <p className="font-mono text-white/70">Scan a student ID barcode to check in</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center w-full">
            <CheckCircle className="w-24 h-24 mb-6" />
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-2">
              {message.split(" - ")[0]}
            </h1>
            <p className="text-2xl md:text-4xl font-mono opacity-90">{message.split(" - ")[1]}</p>

            {guestWifiInfo && (
              <div className="mt-6 p-5 bg-white text-black border-4 border-black shadow-[4px_4px_0_0_#000] font-mono text-left w-full space-y-2.5 rounded-none">
                <p className="font-bold text-center text-indigo-900 border-b-2 border-black pb-1.5 uppercase tracking-wide text-md">
                  📶 Guest Wi-Fi Provisioned
                </p>
                <div className="space-y-1 text-xs font-bold">
                  <div className="flex justify-between">
                    <span>Network (SSID):</span>
                    <span className="text-blue-800">{guestWifiInfo.essid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Username:</span>
                    <span className="text-green-800">{guestWifiInfo.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Password:</span>
                    <span className="text-red-800">{guestWifiInfo.password}</span>
                  </div>
                </div>
                <p className="text-[9px] text-gray-500 text-center font-bold uppercase pt-1.5 border-t border-black/10">
                  Valid for 12 Hours on this Device
                </p>
              </div>
            )}
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
