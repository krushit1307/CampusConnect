import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  QrCode,
  Scan,
  Users,
  Linkedin,
  Mail,
  Phone,
  Calendar,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  encodeBusinessCardPayload,
  downloadVCard,
  type ContactCard,
} from "@/services/digitalBusinessCardService";

export interface UserConnectionItem {
  connection_id: string;
  connected_user_id: string;
  connected_name: string;
  connected_handle?: string;
  connected_email?: string;
  connected_phone?: string;
  connected_linkedin?: string;
  connected_major?: string;
  met_at_event_id?: string;
  met_at_event_title?: string;
  created_at: string;
}

interface DigitalBusinessCardExchangeProps {
  currentUser: {
    id: string;
    name: string;
    handle?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    major?: string;
  };
  currentEventId?: string;
  currentEventTitle?: string;
  connections: UserConnectionItem[];
  onScanConnect?: (scannedUserId: string, eventId?: string) => Promise<void>;
  isLoading?: boolean;
}

export const DigitalBusinessCardExchange: React.FC<DigitalBusinessCardExchangeProps> = ({
  currentUser,
  currentEventId,
  currentEventTitle,
  connections,
  onScanConnect,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>("my-card");
  const [scannedIdInput, setScannedIdInput] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);

  const qrPayload = encodeBusinessCardPayload({
    userId: currentUser.id,
    name: currentUser.name,
    handle: currentUser.handle,
    eventId: currentEventId,
  });

  const handleSimulateScan = async () => {
    if (!scannedIdInput.trim() || !onScanConnect) return;
    setConnecting(true);
    try {
      await onScanConnect(scannedIdInput.trim(), currentEventId);
      setScannedIdInput("");
      setIsScanning(false);
      setActiveTab("rolodex");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <QrCode className="h-6 w-6 text-indigo-400" />
            Digital Business Card & Connections
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Instantly swap contact info and LinkedIn profiles with fellow students at events.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="bg-slate-950 border border-slate-800">
            <TabsTrigger value="my-card" className="text-xs font-semibold">
              My Card
            </TabsTrigger>
            <TabsTrigger value="rolodex" className="text-xs font-semibold">
              Rolodex ({connections.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "my-card" && (
        <div className="flex flex-col md:flex-row items-center gap-8 justify-center py-4">
          <div className="bg-white p-4 rounded-2xl shadow-xl flex flex-col items-center border-4 border-indigo-500/30">
            <QRCodeSVG value={qrPayload} size={200} level="M" />
            <div className="text-[11px] font-mono text-slate-800 mt-2 font-bold uppercase tracking-wider">
              Scan to Connect
            </div>
          </div>

          <div className="space-y-4 max-w-sm text-center md:text-left">
            <div>
              <div className="text-xl font-bold text-slate-100">{currentUser.name}</div>
              {currentUser.handle && (
                <div className="text-xs text-indigo-400 font-mono">@{currentUser.handle}</div>
              )}
              {currentUser.major && (
                <div className="text-sm text-slate-300 font-medium mt-1">{currentUser.major}</div>
              )}
            </div>

            <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              {currentUser.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{currentUser.email}</span>
                </div>
              )}
              {currentUser.linkedin && (
                <div className="flex items-center gap-2">
                  <Linkedin className="h-3.5 w-3.5 text-sky-400" />
                  <span className="truncate">{currentUser.linkedin}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={() => setIsScanning(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-2"
              >
                <Scan className="h-4 w-4" />
                Scan Someone&apos;s Card
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadVCard({
                    name: currentUser.name,
                    email: currentUser.email,
                    phone: currentUser.phone,
                    linkedinUrl: currentUser.linkedin,
                    major: currentUser.major,
                    metAtEventTitle: currentEventTitle,
                  })
                }
                className="border-slate-700 bg-slate-800 text-slate-200 text-xs font-semibold gap-1.5 hover:bg-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                Save .VCF
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "rolodex" && (
        <div className="space-y-4">
          {connections.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/50 rounded-2xl border border-slate-800/80">
              <Users className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No connections yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Scan another attendee&apos;s QR code at an event to save their contact details to
                your personal Rolodex.
              </p>
              <Button
                onClick={() => setIsScanning(true)}
                className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Scan Now
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {connections.map((conn) => (
                <div
                  key={conn.connection_id}
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-slate-100">
                          {conn.connected_name}
                        </div>
                        {conn.connected_major && (
                          <div className="text-xs text-slate-400">{conn.connected_major}</div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          downloadVCard({
                            name: conn.connected_name,
                            email: conn.connected_email,
                            phone: conn.connected_phone,
                            linkedinUrl: conn.connected_linkedin,
                            major: conn.connected_major,
                            metAtEventTitle: conn.met_at_event_title,
                          })
                        }
                        className="h-8 px-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/50 gap-1"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Export VCF</span>
                      </Button>
                    </div>

                    <div className="space-y-1 text-xs text-slate-400 pt-1">
                      {conn.connected_email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-slate-500" />
                          <span className="truncate">{conn.connected_email}</span>
                        </div>
                      )}
                      {conn.connected_linkedin && (
                        <div className="flex items-center gap-1.5">
                          <Linkedin className="h-3 w-3 text-sky-400" />
                          <a
                            href={conn.connected_linkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-400 hover:underline truncate"
                          >
                            LinkedIn Profile
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {conn.met_at_event_title && (
                    <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">Met at: {conn.met_at_event_title}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual / QR Scanner Dialog */}
      <Dialog open={isScanning} onOpenChange={setIsScanning}>
        <DialogContent className="sm:max-w-[420px] bg-slate-950 border-slate-800 text-slate-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Scan Digital Business Card</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Point your camera or paste a connection payload/user ID below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="aspect-square max-w-[200px] mx-auto bg-slate-900 border-2 border-dashed border-indigo-500/40 rounded-2xl flex flex-col items-center justify-center p-4 text-center">
              <Scan className="h-10 w-10 text-indigo-400 animate-pulse mb-2" />
              <span className="text-xs text-slate-400">Camera Viewfinder Ready</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">
                Or Enter User ID / Payload:
              </label>
              <input
                type="text"
                value={scannedIdInput}
                onChange={(e) => setScannedIdInput(e.target.value)}
                placeholder="Paste User ID or QR JSON"
                className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsScanning(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSimulateScan}
              disabled={connecting || !scannedIdInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-xs font-bold"
            >
              {connecting ? "Connecting..." : "Save Connection"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
