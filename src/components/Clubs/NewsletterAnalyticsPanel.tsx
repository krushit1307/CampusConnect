// src/components/Clubs/NewsletterAnalyticsPanel.tsx
import React, { useState, useEffect } from "react";
import {
  Mail,
  Eye,
  MousePointer,
  UserX,
  Plus,
  Send,
  Loader2,
  BarChart3,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Newsletter, NewsletterAnalyticsSummary } from "@/types/newsletter";
import { NewsletterService } from "@/services/newsletterService";

interface NewsletterAnalyticsPanelProps {
  clubId: string;
  onCreateNew?: () => void;
  onEditNewsletter?: (newsletter: Newsletter) => void;
}

export function NewsletterAnalyticsPanel({
  clubId,
  onCreateNew,
  onEditNewsletter,
}: NewsletterAnalyticsPanelProps) {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [analytics, setAnalytics] = useState<NewsletterAnalyticsSummary>({
    totalSent: 0,
    totalRecipients: 0,
    openCount: 0,
    openRate: 0,
    clickCount: 0,
    clickRate: 0,
    unsubscribeCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNewsletterData() {
      setLoading(true);
      try {
        const [list, stats] = await Promise.all([
          NewsletterService.getClubNewsletters(clubId),
          NewsletterService.getClubNewsletterAnalytics(clubId),
        ]);

        setNewsletters(list);
        setAnalytics(stats);
      } catch (err) {
        console.error("Failed to load newsletter panel data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadNewsletterData();
  }, [clubId]);

  if (loading) {
    return (
      <div className="neu-border p-6 bg-white dark:bg-zinc-900 flex items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-black dark:text-white" />
        <span className="font-mono text-xs">Loading newsletter analytics…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 neu-border p-4 bg-white dark:bg-zinc-900">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-black dark:text-white flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-600" /> Club Newsletter Dashboard
          </h2>
          <p className="font-mono text-xs text-gray-500 mt-0.5">
            Design HTML newsletters, dispatch batch emails, and track open/click analytics.
          </p>
        </div>

        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="neu-border bg-black text-white hover:bg-zinc-800 font-mono text-xs font-bold uppercase"
          >
            <Plus className="h-4 w-4 mr-1" /> Create Newsletter
          </Button>
        )}
      </div>

      {/* Aggregate Analytics Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neu-border p-4 bg-white dark:bg-zinc-900 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          <span className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-1">
            Total Newsletters Sent
          </span>
          <p className="font-display text-2xl font-bold text-black dark:text-white">
            {analytics.totalSent}
          </p>
          <span className="font-mono text-[10px] text-gray-400">
            {analytics.totalRecipients.toLocaleString()} total emails delivered
          </span>
        </div>

        <div className="neu-border p-4 bg-white dark:bg-zinc-900 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          <span className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-1">
            Average Open Rate
          </span>
          <p className="font-display text-2xl font-bold text-green-600 flex items-center gap-1">
            <Eye className="h-5 w-5" /> {analytics.openRate}%
          </p>
          <span className="font-mono text-[10px] text-gray-400">
            {analytics.openCount.toLocaleString()} total opens tracked
          </span>
        </div>

        <div className="neu-border p-4 bg-white dark:bg-zinc-900 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          <span className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-1">
            Click-Through Rate (CTR)
          </span>
          <p className="font-display text-2xl font-bold text-blue-600 flex items-center gap-1">
            <MousePointer className="h-5 w-5" /> {analytics.clickRate}%
          </p>
          <span className="font-mono text-[10px] text-gray-400">
            {analytics.clickCount.toLocaleString()} total clicks tracked
          </span>
        </div>

        <div className="neu-border p-4 bg-white dark:bg-zinc-900 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          <span className="font-mono text-[10px] font-bold uppercase text-gray-500 block mb-1">
            Newsletter Unsubscribes
          </span>
          <p className="font-display text-2xl font-bold text-amber-600 flex items-center gap-1">
            <UserX className="h-5 w-5" /> {analytics.unsubscribeCount}
          </p>
          <span className="font-mono text-[10px] text-gray-400">Club newsletter opt-outs</span>
        </div>
      </div>

      {/* Newsletter History Table / List */}
      <div className="neu-border bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
        <h3 className="font-display text-lg font-bold uppercase tracking-tight border-b-2 border-black pb-2 text-black dark:text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" /> Newsletter Campaigns
        </h3>

        {newsletters.length === 0 ? (
          <p className="font-mono text-xs italic text-gray-500 py-6 text-center">
            No newsletters created yet for this club. Click "Create Newsletter" to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {newsletters.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 neu-border p-4 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-display font-bold text-base text-black dark:text-white">
                      {item.title}
                    </span>
                    <span
                      className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 neu-border ${
                        item.status === "sent"
                          ? "bg-green-100 text-green-900 border-green-800"
                          : item.status === "sending"
                            ? "bg-amber-100 text-amber-900 border-amber-800"
                            : "bg-gray-200 text-gray-800 border-gray-800"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    Subject: <strong>{item.subject}</strong>
                  </p>
                  <p className="font-mono text-[10px] text-gray-400 mt-0.5">
                    {item.sent_at
                      ? `Sent ${new Date(item.sent_at).toLocaleString()} • ${item.successful_sends} recipients`
                      : `Created ${new Date(item.created_at).toLocaleDateString()}`}
                  </p>
                </div>

                {onEditNewsletter && (
                  <Button
                    onClick={() => onEditNewsletter(item)}
                    size="sm"
                    variant="outline"
                    className="neu-border font-mono text-xs font-bold uppercase shrink-0"
                  >
                    {item.status === "sent" ? "View / Clone" : "Edit Draft"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
