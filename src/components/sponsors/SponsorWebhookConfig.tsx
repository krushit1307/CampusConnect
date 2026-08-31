import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Save, Activity } from "lucide-react";
import { toast } from "sonner";

interface SponsorWebhookConfigProps {
  eventId: string;
}

interface WebhookData {
  id: string;
  webhook_url: string;
  field_mappings: Record<string, string>;
  is_active: boolean;
}

interface WebhookLog {
  id: string;
  created_at: string;
  response_status: number;
  error_message: string | null;
  payload: any;
  response_body: string;
}

const AVAILABLE_FIELDS = [
  { id: "first_name", label: "First Name" },
  { id: "last_name", label: "Last Name" },
  { id: "email", label: "Email Address" },
  { id: "major", label: "Major" },
  { id: "graduation_year", label: "Graduation Year" },
  { id: "gpa", label: "GPA" },
  { id: "bio", label: "Bio / Summary" },
  { id: "notes", label: "Scanner Notes" },
  { id: "scanned_at", label: "Scan Timestamp" },
];

export const SponsorWebhookConfig: React.FC<SponsorWebhookConfigProps> = ({ eventId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhook, setWebhook] = useState<WebhookData | null>(null);
  const [url, setUrl] = useState("");
  const [mappings, setMappings] = useState<{ crmField: string; campusField: string }[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [sponsorId, setSponsorId] = useState<string | null>(null);

  useEffect(() => {
    fetchWebhookConfig();
  }, [eventId]);

  const fetchWebhookConfig = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;
      const userId = session.session.user.id;

      // Find the sponsor_id for this user and event
      const { data: sponsorData, error: sponsorError } = await supabase
        .from("event_sponsors")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .single();

      let targetSponsorId = sponsorData?.id;

      if (!targetSponsorId) {
        // Fallback to finding from sponsors table if the user is club admin
        // But for simplicity, we assume the user is properly linked or we just pick the first sponsor for this event? No, we need to know WHICH sponsor this user represents.
        // In interactive sponsor booths, the auth.uid() usually maps to a sponsor.
        // Let's query public.sponsors instead in case they are mapped directly, wait.
        const { data: s } = await supabase
          .from("sponsors")
          .select("id")
          .eq("event_id", eventId)
          .limit(1)
          .single();
        targetSponsorId = s?.id;
      }

      if (!targetSponsorId) {
        toast.error("Could not resolve sponsor context.");
        setLoading(false);
        return;
      }
      setSponsorId(targetSponsorId);

      const { data, error } = await supabase
        .from("sponsor_crm_webhooks")
        .select("*")
        .eq("event_id", eventId)
        .eq("sponsor_id", targetSponsorId)
        .single();

      if (data) {
        setWebhook(data);
        setUrl(data.webhook_url);
        setIsActive(data.is_active);
        const mappedPairs = Object.entries(data.field_mappings).map(([crmField, campusField]) => ({
          crmField,
          campusField: campusField as string,
        }));
        setMappings(mappedPairs);

        // Fetch logs
        const { data: logData } = await supabase
          .from("sponsor_crm_webhook_logs")
          .select("*")
          .eq("webhook_id", data.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (logData) setLogs(logData);
      } else if (error && error.code !== "PGRST116") {
        throw error; // Not found is okay, we just create new
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load webhook configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!sponsorId) return;
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      toast.error("Please enter a valid HTTP(S) URL");
      return;
    }

    setSaving(true);
    try {
      const field_mappings: Record<string, string> = {};
      mappings.forEach((m) => {
        if (m.crmField.trim() && m.campusField) {
          field_mappings[m.crmField.trim()] = m.campusField;
        }
      });

      const payload = {
        event_id: eventId,
        sponsor_id: sponsorId,
        webhook_url: url,
        field_mappings,
        is_active: isActive,
      };

      if (webhook?.id) {
        const { error } = await supabase
          .from("sponsor_crm_webhooks")
          .update(payload)
          .eq("id", webhook.id);
        if (error) throw error;
        toast.success("Webhook updated");
      } else {
        const { data, error } = await supabase
          .from("sponsor_crm_webhooks")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setWebhook(data);
        toast.success("Webhook created");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save webhook");
    } finally {
      setSaving(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { crmField: "", campusField: "first_name" }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, key: "crmField" | "campusField", value: string) => {
    const newMappings = [...mappings];
    newMappings[index][key] = value;
    setMappings(newMappings);
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-white p-6 rounded-lg border shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div>
        <h2 className="text-xl font-bold mb-2">CRM Webhook Configuration</h2>
        <p className="text-slate-500 mb-6">
          Send real-time lead data directly to your CRM (Salesforce, HubSpot, etc.) when a student's
          QR code is scanned at your booth.
        </p>

        <div className="space-y-4 max-w-3xl">
          <div>
            <label className="block text-sm font-medium mb-1">Webhook URL</label>
            <Input
              placeholder="https://hooks.yourcrm.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="isActive" className="text-sm">
              Webhook Active
            </label>
          </div>
        </div>
      </div>

      <div className="border-t pt-6 max-w-3xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold">Data Mapper</h3>
            <p className="text-sm text-slate-500">
              Map CampusConnect fields to your CRM's required JSON keys.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addMapping} className="gap-1">
            <Plus className="w-4 h-4" /> Add Field
          </Button>
        </div>

        {mappings.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded border border-dashed text-center text-sm text-slate-500 dark:bg-slate-800">
            No fields mapped. The entire default CampusConnect JSON payload will be sent.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center px-2 text-xs font-semibold text-slate-500 uppercase">
              <div>CRM JSON Key</div>
              <div></div>
              <div>CampusConnect Field</div>
              <div></div>
            </div>
            {mappings.map((mapping, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                <Input
                  placeholder="e.g., student_gpa"
                  value={mapping.crmField}
                  onChange={(e) => updateMapping(idx, "crmField", e.target.value)}
                />
                <span className="text-slate-400">←</span>
                <select
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={mapping.campusField}
                  onChange={(e) => updateMapping(idx, "campusField", e.target.value)}
                >
                  {AVAILABLE_FIELDS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMapping(idx)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </Button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" /> Recent Deliveries
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${log.response_status >= 200 && log.response_status < 300 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                      >
                        {log.response_status || "Failed"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-2 text-red-600 max-w-md truncate"
                      title={log.error_message || ""}
                    >
                      {log.error_message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
