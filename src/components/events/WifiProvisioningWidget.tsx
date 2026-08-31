import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Download from "lucide-react/dist/esm/icons/download";

interface WifiProvisioningWidgetProps {
  targetCampus: string;
  userId: string;
}

interface WifiCertRecord {
  id: string;
  target_campus: string;
  cert_serial: string;
  expires_at: string;
}

export function WifiProvisioningWidget({ targetCampus, userId }: WifiProvisioningWidgetProps) {
  const [cert, setCert] = useState<WifiCertRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCert = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("wifi_certificates")
      .select("*")
      .eq("target_campus", targetCampus)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setCert(data);
  };

  useEffect(() => {
    if (userId) fetchCert();
  }, [targetCampus, userId]);

  const handleDownloadProfile = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("generate-wifi-profile", {
        body: {
          targetCampus,
          userId,
          format: "json",
        },
      });

      if (error) throw error;

      // Download .mobileconfig file locally
      const blob = new Blob([data.mobileconfig], { type: "application/x-apple-aspen-config" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${targetCampus}_WiFi_Profile.mobileconfig`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      alert("Wi-Fi Configuration Profile downloaded! Open Settings to install it.");
      fetchCert();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to generate Wi-Fi profile.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="wifi-provisioning-widget"
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono text-xs my-6 space-y-6"
    >
      <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2 border-b-4 border-black pb-3">
        <Wifi className="text-blue-600 animate-pulse" size={18} />
        WPA2-Enterprise (Eduroam) EAP-TLS WiFi Provisioning
      </h3>

      <div className="space-y-3">
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Modern mobile operating systems rotate MAC addresses aggressively for privacy. Installing
          an EAP-TLS client profile allows seamless roaming on **{targetCampus}** networks without
          captive portal interruptions.
        </p>

        {cert ? (
          <div className="bg-emerald-50 border-2 border-black p-4 space-y-2">
            <div className="font-black text-emerald-800 uppercase text-[10px]">
              🟢 Active Roaming Certificate Configured
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-emerald-700 font-bold">
              <div>Serial: {cert.cert_serial}</div>
              <div>Expires: {new Date(cert.expires_at).toLocaleDateString()}</div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border-2 border-black p-3 text-[10px] font-bold text-yellow-800 flex items-center gap-2">
            <ShieldAlert size={16} />
            No active client credentials found for {targetCampus} roaming.
          </div>
        )}
      </div>

      <button
        onClick={handleDownloadProfile}
        disabled={isLoading}
        data-testid="provision-wifi-btn"
        className="border-2 border-black bg-yellow-300 px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000] flex items-center gap-2"
      >
        <Download size={14} />
        {isLoading ? "Provisioning..." : `Get ${targetCampus} WiFi Profile (.mobileconfig)`}
      </button>
    </div>
  );
}
