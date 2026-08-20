import React, { useState } from "react";
import {
  Webhook as WebhookIcon,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Key,
  Copy,
  ExternalLink,
  ShieldCheck,
  RotateCw,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  WebhookEndpoint,
  WebhookDeliveryLog,
  AVAILABLE_WEBHOOK_EVENTS,
  generateWebhookSecretKey,
  generateHmacSha256Signature,
  formatWebhookPayload,
} from "@/lib/webhookSigner";
import { cn } from "@/lib/utils";

export interface WebhookPortalProps {
  clubId?: string;
  clubName?: string;
  initialEndpoints?: WebhookEndpoint[];
  initialDeliveries?: WebhookDeliveryLog[];
  onSaveEndpoint?: (endpoint: WebhookEndpoint) => void;
  onDeleteEndpoint?: (endpointId: string) => void;
  className?: string;
}

export const MOCK_INITIAL_ENDPOINTS: WebhookEndpoint[] = [
  {
    id: "ep-1",
    club_id: "club-cs-1",
    endpoint_url: "https://discord.com/api/webhooks/12345/campus-bot",
    secret_key: "whsec_a1b2c3d4e5f67890123456789abcdef0",
    description: "Discord Bot RSVP & Announcement Notifications",
    active: true,
    subscriptions: ["rsvp.created", "event.published"],
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const MOCK_INITIAL_DELIVERIES: WebhookDeliveryLog[] = [
  {
    id: "del-1",
    endpoint_id: "ep-1",
    event_type: "rsvp.created",
    payload: {
      id: "evt_wh_1001",
      event: "rsvp.created",
      data: { eventId: "evt-gala", attendeeName: "Alex Rivera" },
    },
    status_code: 200,
    response_body: '{"status": "ok"}',
    success: true,
    attempt: 1,
    delivered_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "del-2",
    endpoint_id: "ep-1",
    event_type: "event.published",
    payload: {
      id: "evt_wh_1002",
      event: "event.published",
      data: { title: "Winter Hackathon 2026" },
    },
    status_code: 200,
    response_body: '{"status": "ok"}',
    success: true,
    attempt: 1,
    delivered_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
];

export const WebhookPortal: React.FC<WebhookPortalProps> = ({
  clubId = "club-cs-1",
  clubName = "Computer Science Society",
  initialEndpoints = MOCK_INITIAL_ENDPOINTS,
  initialDeliveries = MOCK_INITIAL_DELIVERIES,
  onSaveEndpoint,
  onDeleteEndpoint,
  className,
}) => {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>(initialEndpoints);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryLog[]>(initialDeliveries);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [visibleSecretId, setVisibleSecretId] = useState<string | null>(null);
  const [testPingStatus, setTestPingStatus] = useState<string | null>(null);

  // New Endpoint Form State
  const [url, setUrl] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "rsvp.created",
    "event.published",
  ]);

  const handleToggleEvent = (eventType: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventType) ? prev.filter((e) => e !== eventType) : [...prev, eventType]
    );
  };

  const handleCreateEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || selectedEvents.length === 0) return;

    const newEp: WebhookEndpoint = {
      id: `ep-${Date.now()}`,
      club_id: clubId,
      endpoint_url: url.trim(),
      secret_key: generateWebhookSecretKey(),
      description: description.trim() || "Developer Webhook Receiver",
      active: true,
      subscriptions: selectedEvents,
      created_at: new Date().toISOString(),
    };

    const updated = [...endpoints, newEp];
    setEndpoints(updated);
    if (onSaveEndpoint) onSaveEndpoint(newEp);

    // Reset Form
    setUrl("");
    setDescription("");
    setSelectedEvents(["rsvp.created", "event.published"]);
    setShowAddModal(false);
  };

  const handleDeleteEndpoint = (id: string) => {
    const updated = endpoints.filter((ep) => ep.id !== id);
    setEndpoints(updated);
    if (onDeleteEndpoint) onDeleteEndpoint(id);
  };

  const handleSendTestPing = (ep: WebhookEndpoint) => {
    const payload = formatWebhookPayload("rsvp.created", clubId, {
      test: true,
      message: "Ping from CampusConnect Webhook Portal",
      timestamp: Date.now(),
    });
    const signature = generateHmacSha256Signature(ep.secret_key, payload);

    const newLog: WebhookDeliveryLog = {
      id: `del-${Date.now()}`,
      endpoint_id: ep.id,
      event_type: "rsvp.created",
      payload,
      status_code: 200,
      response_body: '{"received": true}',
      success: true,
      attempt: 1,
      delivered_at: new Date().toISOString(),
    };

    setDeliveries((prev) => [newLog, ...prev]);
    setTestPingStatus(`Test ping delivered to ${ep.endpoint_url} (Signature: ${signature.slice(0, 24)}...)`);
    setTimeout(() => setTestPingStatus(null), 5000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-sky-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-sky-950">
            <WebhookIcon className="w-5 h-5 text-sky-700" />
            <span>Developer Webhook Subscriptions Portal — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Build custom Discord bots, dashboards, and automation. Receive cryptographically signed HMAC SHA-256 event notifications in real-time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Webhook Endpoint
        </button>
      </div>

      {/* Test Ping Status Banner */}
      {testPingStatus && (
        <div className="p-3 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{testPingStatus}</span>
        </div>
      )}

      {/* Main Content: Registered Endpoints & Recent Delivery Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Webhook Endpoints List */}
        <div className="p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              Active Webhook Endpoints ({endpoints.length})
            </h4>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
              HMAC SHA-256 Enforced
            </span>
          </div>

          {endpoints.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-xl text-xs text-gray-500">
              No webhook endpoints registered yet. Click "Add Webhook Endpoint" to configure a callback URL.
            </div>
          ) : (
            <div className="space-y-3">
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="p-4 border-2 border-black rounded-lg bg-slate-50 space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="font-bold text-xs text-black truncate max-w-[220px]">
                          {ep.endpoint_url}
                        </span>
                      </div>
                      <p className="text-xs font-sans text-gray-600">{ep.description}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSendTestPing(ep)}
                        className="px-2.5 py-1 border border-black bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold text-[11px] rounded flex items-center gap-1"
                        title="Send test ping"
                      >
                        <Send className="w-3 h-3" />
                        Test Ping
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEndpoint(ep.id)}
                        className="p-1 border border-black bg-rose-100 hover:bg-rose-200 text-rose-800 rounded"
                        title="Delete endpoint"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Secret Key Bar */}
                  <div className="p-2 bg-white border border-gray-300 rounded flex items-center justify-between text-[11px]">
                    <span className="font-bold text-gray-700 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                      Signing Secret:
                    </span>
                    <span className="font-mono text-gray-800">
                      {visibleSecretId === ep.id ? ep.secret_key : `${ep.secret_key.slice(0, 10)}••••••••••••`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVisibleSecretId(visibleSecretId === ep.id ? null : ep.id)}
                      className="text-gray-600 hover:text-black"
                    >
                      {visibleSecretId === ep.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Subscribed Events Tags */}
                  <div className="flex flex-wrap gap-1">
                    {ep.subscriptions.map((sub, sIdx) => (
                      <span
                        key={sIdx}
                        className="text-[10px] font-bold bg-sky-100 border border-sky-300 text-sky-900 px-2 py-0.5 rounded"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Webhook Delivery Logs Table */}
        <div className="p-5 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <RotateCw className="w-4 h-4 text-sky-600" />
              Recent Webhook Deliveries
            </h4>
            <span className="text-[11px] text-gray-500 font-sans">Background Queue Log</span>
          </div>

          <div className="border-2 border-black rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-black font-bold uppercase text-gray-800">
                  <th className="p-2 border-r border-black">Event</th>
                  <th className="p-2 border-r border-black">Status</th>
                  <th className="p-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y border-black font-sans">
                {deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-50">
                    <td className="p-2 font-mono font-bold text-sky-900 border-r border-black">
                      {del.event_type}
                    </td>
                    <td className="p-2 border-r border-black">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold rounded-full border",
                          del.success
                            ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                            : "bg-rose-100 border-rose-400 text-rose-900"
                        )}
                      >
                        {del.status_code} {del.success ? "OK" : "Failed"}
                      </span>
                    </td>
                    <td className="p-2 text-[11px] text-gray-500 font-mono">
                      {new Date(del.delivered_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Webhook Endpoint Modal Form */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateEndpoint}
            className="bg-white border-2 border-black rounded-xl max-w-xl w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] overflow-auto font-mono"
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-base uppercase flex items-center gap-2">
                <WebhookIcon className="w-5 h-5 text-sky-600" />
                Register New Webhook Endpoint
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="webhook-url-input" className="text-xs font-bold uppercase block mb-1">
                  Callback Endpoint URL *
                </label>
                <input
                  id="webhook-url-input"
                  type="url"
                  required
                  placeholder="https://yourserver.com/api/campus-webhook"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>

              <div>
                <label htmlFor="webhook-desc-input" className="text-xs font-bold uppercase block mb-1">
                  Description / Service Name
                </label>
                <input
                  id="webhook-desc-input"
                  type="text"
                  placeholder="e.g. Discord Bot / Internal Club Dashboard"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-sans bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase block mb-2">
                  Subscribe to System Events *
                </label>
                <div className="space-y-2">
                  {AVAILABLE_WEBHOOK_EVENTS.map((evt) => {
                    const isChecked = selectedEvents.includes(evt.type);
                    return (
                      <div
                        key={evt.type}
                        onClick={() => handleToggleEvent(evt.type)}
                        className={cn(
                          "p-2.5 border-2 rounded-md cursor-pointer transition-all flex items-center justify-between text-xs",
                          isChecked ? "border-black bg-sky-50 font-bold" : "border-gray-300 opacity-60"
                        )}
                      >
                        <div>
                          <div className="text-black font-mono">{evt.type}</div>
                          <div className="text-[11px] text-gray-500 font-sans">{evt.description}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 accent-sky-600"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t-2 border-black/10">
              <button
                type="submit"
                className="px-4 py-2 border-2 border-black bg-sky-600 text-white font-bold text-xs uppercase rounded-md hover:bg-sky-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Save & Generate Secret Key
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
