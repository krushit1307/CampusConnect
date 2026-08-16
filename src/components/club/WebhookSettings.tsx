// src/components/club/WebhookSettings.tsx
//
// UI for club admins to add, test, and remove webhook integrations.

import { useEffect, useState } from "react";
import { Trash2, Send, Plus, Loader2, CheckCircle2, AlertCircle, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    fetchClubIntegrations,
    addIntegration,
    removeIntegration,
    testWebhook,
    type ClubIntegration,
} from "@/lib/clubIntegrations";

interface WebhookSettingsProps {
    clubId: string;
}

export function WebhookSettings({ clubId }: WebhookSettingsProps) {
    const [integrations, setIntegrations] = useState<ClubIntegration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newUrl, setNewUrl] = useState("");
    const [newProvider, setNewProvider] = useState<"discord" | "slack" | "generic">("discord");
    const [isAdding, setIsAdding] = useState(false);
    const [testStatus, setTestStatus] = useState<Record<string, { loading: boolean; result?: { success: boolean; message: string } }>>({});

    useEffect(() => {
        loadIntegrations();
    }, [clubId]);

    const loadIntegrations = async () => {
        setIsLoading(true);
        const data = await fetchClubIntegrations(clubId);
        setIntegrations(data);
        setIsLoading(false);
    };

    const handleAdd = async () => {
        if (!newUrl) return;
        setIsAdding(true);
        const result = await addIntegration(clubId, newProvider, newUrl);
        setIsAdding(false);
        if (result.success) {
            setNewUrl("");
            await loadIntegrations();
        } else {
            alert(result.error ?? "Failed to add webhook");
        }
    };

    const handleRemove = async (id: string) => {
        const ok = await removeIntegration(id);
        if (ok) {
            setIntegrations(integrations.filter((i) => i.id !== id));
        }
    };

    const handleTest = async (integration: ClubIntegration) => {
        setTestStatus((s) => ({ ...s, [integration.id]: { loading: true } }));
        const result = await testWebhook(integration.webhook_url, integration.provider_type);
        setTestStatus((s) => ({
            ...s,
            [integration.id]: { loading: false, result },
        }));
        // Clear the result after 5 seconds
        setTimeout(() => {
            setTestStatus((s) => {
                const next = { ...s };
                delete next[integration.id];
                return next;
            });
        }, 5000);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Existing integrations */}
            <div className="space-y-3">
                {integrations.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                        No webhooks configured. Add one below to automatically post new events to Discord or Slack.
                    </p>
                ) : (
                    integrations.map((integration) => (
                        <div
                            key={integration.id}
                            className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <Webhook className="h-5 w-5 text-indigo-500" />
                                <div>
                                    <p className="text-sm font-medium capitalize">
                                        {integration.provider_type}
                                    </p>
                                    <p className="max-w-xs truncate text-xs text-slate-400">
                                        {integration.webhook_url.replace(/\/api\/webhooks\/\d+\/\w+/, "/api/webhooks/•••/•••")}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Test result */}
                                {testStatus[integration.id]?.result && (
                                    <span
                                        className={`flex items-center gap-1 text-xs font-medium ${
                                            testStatus[integration.id].result.success
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-red-600 dark:text-red-400"
                                        }`}
                                    >
                                        {testStatus[integration.id].result.success ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4" />
                                        )}
                                        {testStatus[integration.id].result.message}
                                    </span>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleTest(integration)}
                                    disabled={testStatus[integration.id]?.loading}
                                    className="gap-1.5"
                                >
                                    {testStatus[integration.id]?.loading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Send className="h-3.5 w-3.5" />
                                    )}
                                    Test
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemove(integration.id)}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add new webhook */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <h4 className="mb-3 text-sm font-semibold">Add New Webhook</h4>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <Label htmlFor="provider">Provider</Label>
                        <select
                            id="provider"
                            value={newProvider}
                            onChange={(e) => setNewProvider(e.target.value as "discord" | "slack" | "generic")}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                        >
                            <option value="discord">Discord</option>
                            <option value="slack">Slack</option>
                            <option value="generic">Generic</option>
                        </select>
                    </div>
                    <div className="flex-[2]">
                        <Label htmlFor="webhook-url">Webhook URL</Label>
                        <Input
                            id="webhook-url"
                            type="url"
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            placeholder="https://discord.com/api/webhooks/..."
                        />
                    </div>
                    <Button onClick={handleAdd} disabled={!newUrl || isAdding} className="gap-1.5">
                        {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add
                    </Button>
                </div>
            </div>
        </div>
    );
}
