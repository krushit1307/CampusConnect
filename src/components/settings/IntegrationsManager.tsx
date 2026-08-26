// =============================================================================
// Component: IntegrationsManager
//  Issue: #3542 - Implement 'Automated Multi-Channel Cross-Posting'
//  Description: The UI portal for Club Admins to manage their Discord and Slack
//  webhooks. Features a form to add new URLs, a list of active integrations
//  with toggle switches, and a "Test" button that triggers a live ping.
// =============================================================================

import React, { useState } from 'react';
import { useClubIntegrations, IntegrationPlatform } from '../../hooks/useClubIntegrations';
import { buildDiscordPreviewHTML, buildSlackPreviewHTML } from '../../lib/social/embedBuilders';

interface IntegrationsManagerProps {
    clubId: string;
    clubName: string;
}

export const IntegrationsManager: React.FC<IntegrationsManagerProps> = ({ clubId, clubName }) => {
    const {
        integrations,
        isLoading,
        isTesting,
        error,
        addIntegration,
        toggleActive,
        deleteIntegration,
        testIntegration
    } = useClubIntegrations(clubId);

    const [showForm, setShowForm] = useState(false);
    const [platform, setPlatform] = useState<IntegrationPlatform>('discord');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [channelName, setChannelName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');

    const handlePlatformChange = (newPlatform: IntegrationPlatform) => {
        setPlatform(newPlatform);
        // Generate dummy preview
        const dummyEvent = {
            title: "Spring Networking Gala",
            description: "Join us for an evening of professional networking, pizza, and guest speakers from top tech companies.",
            event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            location: "Student Union Ballroom",
            cover_image_url: null,
            club_name: clubName
        };

        if (newPlatform === 'discord') {
            setPreviewHtml(buildDiscordPreviewHTML(dummyEvent));
        } else {
            setPreviewHtml(buildSlackPreviewHTML(dummyEvent));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await addIntegration(platform, webhookUrl, channelName);
        if (success) {
            setShowForm(false);
            setWebhookUrl('');
            setChannelName('');
        }
        setIsSubmitting(false);
    };

    // Initialize preview on mount
    React.useEffect(() => {
        handlePlatformChange('discord');
    }, [clubName]);

    const getPlatformIcon = (p: string) => {
        if (p === 'discord') return '🎮';
        if (p === 'slack') return '💬';
        return '🏢';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">Social Integrations</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Automatically cross-post new events to your Discord or Slack channels.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Webhook
                </button>
            </div>

            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Add Integration Form */}
            {showForm && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg animate-slide-down">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Configure New Webhook</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Form Inputs */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Platform</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePlatformChange('discord')}
                                        className={`p-3 rounded-lg border-2 text-sm font-bold transition-all ${platform === 'discord'
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        🎮 Discord
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePlatformChange('slack')}
                                        className={`p-3 rounded-lg border-2 text-sm font-bold transition-all ${platform === 'slack'
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        💬 Slack
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Webhook URL</label>
                                <input
                                    type="url"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    placeholder={platform === 'discord' ? 'https://discord.com/api/webhooks/...' : 'https://hooks.slack.com/services/...'}
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
                                    required
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Paste the incoming webhook URL from your server settings.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Channel Name (Optional)</label>
                                <input
                                    type="text"
                                    value={channelName}
                                    onChange={(e) => setChannelName(e.target.value)}
                                    placeholder="#events-announcements"
                                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-bold"
                                >
                                    {isSubmitting ? 'Saving...' : 'Save Integration'}
                                </button>
                            </div>
                        </form>

                        {/* Live Preview */}
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                Message Preview
                            </p>
                            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Integrations List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
                </div>
            ) : integrations.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Integrations Configured</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Add a Discord or Slack webhook to automatically broadcast your events to your community.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {integrations.map(integration => (
                        <div
                            key={integration.id}
                            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between gap-4 shadow-sm"
                        >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl flex-shrink-0">
                                    {getPlatformIcon(integration.platform)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900 dark:text-white capitalize">
                                            {integration.platform}
                                        </h4>
                                        {integration.channel_name && (
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                                {integration.channel_name}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate font-mono">
                                        {integration.webhook_url}
                                    </p>
                                    {integration.last_tested_at && (
                                        <p className={`text-xs mt-1 font-medium ${integration.last_test_status === 'success'
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-red-600 dark:text-red-400'
                                            }`}>
                                            Last test: {integration.last_test_status === 'success' ? '✅ Success' : '❌ Failed'} ({new Date(integration.last_tested_at).toLocaleString()})
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                                <button
                                    onClick={() => testIntegration(integration.id)}
                                    disabled={isTesting === integration.id}
                                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-50 transition-colors"
                                >
                                    {isTesting === integration.id ? 'Sending...' : 'Test Ping'}
                                </button>

                                {/* Toggle Switch */}
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={integration.is_active}
                                        onChange={(e) => toggleActive(integration.id, e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>

                                <button
                                    onClick={() => deleteIntegration(integration.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Delete Integration"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
