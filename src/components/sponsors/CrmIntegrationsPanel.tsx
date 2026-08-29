// =============================================================================
// Component: CrmIntegrationsPanel
// Issue: #4418 - Dynamic 'Sponsor Lead' CRM Integration
// Description: The 'CRM Integrations' tab of the Sponsor Dashboard. Sponsors
// connect HubSpot or Salesforce once by pasting an API token; afterwards every
// booth-scanned lead is mapped to a CRM Contact and pushed over instantly.
// Credentials live server-side only - this panel submits them once over TLS
// and only ever re-displays the masked hint returned by the backend.
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  type CrmProvider,
  type CrmDeliveryStatus,
  maskCredential,
  validateCredential,
} from "../../services/sponsorCrmIntegrationService";

export interface StoredCrmConnection {
  id: string;
  provider: CrmProvider;
  credential_hint: string;
  instance_url: string | null;
  enabled: boolean;
}

export interface StoredCrmDelivery {
  id: string;
  status: CrmDeliveryStatus;
  attempts: number;
  crm_record_id: string | null;
  last_error: string | null;
  created_at: string;
}

interface CrmIntegrationsPanelProps {
  sponsorId: string;
}

const PROVIDERS: Array<{
  value: CrmProvider;
  label: string;
  blurb: string;
  tokenLabel: string;
}> = [
  {
    value: "hubspot",
    label: "HubSpot",
    blurb: "Private-app token from your HubSpot developer settings.",
    tokenLabel: "HubSpot Private App Token",
  },
  {
    value: "salesforce",
    label: "Salesforce",
    blurb: "OAuth access token plus its instance URL.",
    tokenLabel: "Salesforce OAuth Access Token",
  },
];

export const CrmIntegrationsPanel: React.FC<CrmIntegrationsPanelProps> = ({ sponsorId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [connection, setConnection] = useState<StoredCrmConnection | null>(null);
  const [deliveries, setDeliveries] = useState<StoredCrmDelivery[]>([]);
  const [provider, setProvider] = useState<CrmProvider>("hubspot");
  const [secret, setSecret] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(
    null,
  );

  const supabase = createClient();

  const loadConnection = useCallback(async () => {
    const { data, error } = await supabase
      .from("sponsor_crm_connections")
      .select("id, provider, credential_hint, instance_url, enabled")
      .eq("sponsor_id", sponsorId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      setConnection(data as StoredCrmConnection);
      setProvider(data.provider);
      setInstanceUrl(data.instance_url ?? "");
    }

    if (data?.id) {
      const { data: rows, error: deliveryError } = await supabase
        .from("sponsor_crm_deliveries")
        .select("id, status, attempts, crm_record_id, last_error, created_at")
        .eq("connection_id", (data as StoredCrmConnection).id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (deliveryError) throw deliveryError;
      setDeliveries((rows ?? []) as StoredCrmDelivery[]);
    }
  }, [supabase, sponsorId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadConnection()
      .catch((err: Error) => {
        if (!cancelled) {
          setFeedback({
            kind: "error",
            text: err.message || "Failed to load your CRM integration.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadConnection]);

  const activeProvider = PROVIDERS.find((p) => p.value === provider)!;

  const handleSave = async () => {
    setFeedback(null);

    const validationProblem = validateCredential(provider, secret);
    if (validationProblem) {
      setFeedback({ kind: "error", text: validationProblem });
      return;
    }
    if (provider === "salesforce" && !/^https:\/\/.+/.test(instanceUrl.trim())) {
      setFeedback({
        kind: "error",
        text: "Salesforce requires the OAuth token's instance URL (https://yourorg.my.salesforce.com).",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Reuse the stored secret when the field still holds a mask placeholder.
      const secretToStore = secret.includes("\u2022\u2022\u2022\u2022") ? undefined : secret.trim();

      const row: Record<string, unknown> = {
        sponsor_id: sponsorId,
        provider,
        credential_hint:
          secretToStore !== undefined ? maskCredential(secretToStore) : connection?.credential_hint,
        instance_url: provider === "salesforce" ? instanceUrl.trim().replace(/\/+$/, "") : null,
        enabled: true,
      };
      if (secretToStore !== undefined) row.credential_secret = secretToStore;

      const { error } = await supabase
        .from("sponsor_crm_connections")
        .upsert(row, { onConflict: "sponsor_id" });
      if (error) throw error;

      setSecret("");
      await loadConnection();
      setFeedback({
        kind: "success",
        text: `Connected! Every newly scanned booth lead will now flow straight into ${activeProvider.label}.`,
      });
    } catch (err: any) {
      setFeedback({
        kind: "error",
        text: err?.message || "Failed to save the integration.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!connection) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("sponsor_crm_connections")
        .update({ enabled: !connection.enabled })
        .eq("id", connection.id);
      if (error) throw error;
      await loadConnection();
    } catch (err: any) {
      setFeedback({ kind: "error", text: err?.message || "Failed to update the integration." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse" data-testid="crm-panel-loading">
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="crm-integrations-panel">
      {/* Connection card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">CRM Integrations</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Connect HubSpot or Salesforce and every booth-scanned lead is synced into your CRM
              instantly - no more CSV hand-offs.
            </p>
          </div>
          {connection && (
            <button
              type="button"
              onClick={handleToggle}
              disabled={isSaving}
              data-testid="toggle-connection"
              aria-pressed={connection.enabled}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-colors ${
                connection.enabled
                  ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {connection.enabled ? "Sync Active" : "Paused"}
            </button>
          )}
        </div>

        {/* Provider picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => {
            const selected = provider === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setProvider(p.value)}
                data-testid={`provider-${p.value}`}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selected
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                }`}
              >
                <p className="font-bold text-gray-900 dark:text-white">{p.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{p.blurb}</p>
              </button>
            );
          })}
        </div>

        {/* Credential form */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {activeProvider.tokenLabel}
            </span>
            <input
              type="password"
              autoComplete="off"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={
                connection && connection.provider === provider
                  ? connection.credential_hint
                  : provider === "hubspot"
                    ? "pat-na1-..."
                    : "00D...access token"
              }
              data-testid="crm-secret-input"
              className="mt-1 w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </label>

          {provider === "salesforce" && (
            <label className="block" data-testid="crm-instance-url-wrapper">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Instance URL
              </span>
              <input
                type="url"
                autoComplete="off"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                placeholder="https://your-org.my.salesforce.com"
                data-testid="crm-instance-url"
                className="mt-1 w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </label>
          )}

          <Button onClick={handleSave} disabled={isSaving} data-testid="save-connection">
            {isSaving ? "Saving..." : connection ? "Update Connection" : "Connect"}
          </Button>

          {feedback && (
            <p
              data-testid="crm-feedback"
              className={`text-sm ${
                feedback.kind === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {feedback.text}
            </p>
          )}
        </div>
      </div>

      {/* Recent syncs */}
      <div
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
        data-testid="crm-deliveries"
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="font-bold text-gray-900 dark:text-white">Recent CRM Syncs</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Latest leads pushed to your CRM (most recent first).
          </p>
        </div>
        {deliveries.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No syncs yet. Scan a badge at your next booth and watch contacts appear here.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {deliveries.map((d) => (
              <li key={d.id} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">
                    Contact {d.crm_record_id ?? "pending"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {new Date(d.created_at).toLocaleString()}
                    {d.attempts > 1 ? ` · ${d.attempts} attempts` : ""}
                    {d.last_error ? ` · ${d.last_error}` : ""}
                  </p>
                </div>
                <span
                  data-testid={`delivery-status-${d.id}`}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    d.status === "DELIVERED"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : d.status === "PENDING"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {d.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CrmIntegrationsPanel;
