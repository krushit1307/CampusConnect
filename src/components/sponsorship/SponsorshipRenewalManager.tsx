/**
 * Sponsorship Renewal Manager Dashboard Component
 * Issue #4141
 * Displays expiring tiers, triggers automated Stripe invoicing, monitors active logo
 * placements in the sponsor rotator, and provides manual payment resolution.
 */

import React, { useState } from 'react';
import {
  SponsorshipTierRenewal,
  SponsorshipInvoice,
  RenewalCronSummary,
} from '../../types/sponsorshipRenewal';
import { calculateDaysToExpiration } from '../../lib/sponsorshipRenewalEngine';
import {
  DollarSign,
  Calendar,
  AlertTriangle,
  Play,
  Mail,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Image,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';

interface SponsorshipRenewalManagerProps {
  sponsorships: SponsorshipTierRenewal[];
  onRunCron: () => Promise<{
    updatedList: SponsorshipTierRenewal[];
    invoices: SponsorshipInvoice[];
    summary: RenewalCronSummary;
  }>;
  onPaySponsorship: (id: string) => Promise<void>;
  onToggleRotator: (id: string, active: boolean) => Promise<void>;
}

export const SponsorshipRenewalManager: React.FC<
  SponsorshipRenewalManagerProps
> = ({ sponsorships, onRunCron, onPaySponsorship, onToggleRotator }) => {
  const [isRunningCron, setIsRunningCron] = useState(false);
  const [cronSummary, setCronSummary] = useState<RenewalCronSummary | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SponsorshipTierRenewal | null>(null);

  const handleExecuteCron = async () => {
    setIsRunningCron(true);
    try {
      const res = await onRunCron();
      setCronSummary(res.summary);
    } catch (err) {
      console.error('Failed to run renewal engine:', err);
    } finally {
      setIsRunningCron(false);
    }
  };

  const activeInRotatorCount = sponsorships.filter((s) => s.is_active_in_rotator).length;
  const pendingInvoicedCount = sponsorships.filter(
    (s) => s.renewal_status === 'renewal_invoiced_30d'
  ).length;
  const expiredDelistedCount = sponsorships.filter(
    (s) => s.renewal_status === 'rotator_delisted'
  ).length;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Metrics & Cron Runner Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Managed Sponsors</span>
          <p className="text-2xl font-extrabold text-slate-100">{sponsorships.length}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-1">
          <span className="text-xs text-emerald-400 font-medium">Live in Sponsor Rotator</span>
          <p className="text-2xl font-extrabold text-emerald-400">{activeInRotatorCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-1">
          <span className="text-xs text-amber-400 font-medium">30d Invoices Dispatched</span>
          <p className="text-2xl font-extrabold text-amber-400">{pendingInvoicedCount}</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/30 space-y-1">
          <span className="text-xs text-rose-400 font-medium">Delisted (Unpaid)</span>
          <p className="text-2xl font-extrabold text-rose-400">{expiredDelistedCount}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h4 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Automated Renewal & Stripe Invoicing Engine</span>
          </h4>
          <p className="text-xs text-slate-400">
            Daily cron job scans for expirations within 30 days, generates Stripe
            invoices, and evicts unpaid logos.
          </p>
        </div>

        <button
          onClick={handleExecuteCron}
          disabled={isRunningCron}
          className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 ${isRunningCron ? 'animate-spin' : ''}`} />
          <span>{isRunningCron ? 'Running Engine...' : 'Run Invoicing Cron Engine'}</span>
        </button>
      </div>

      {/* Cron Execution Report Banner */}
      {cronSummary && (
        <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/40 text-xs space-y-1.5 animate-in fade-in">
          <div className="font-bold text-blue-300 flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-blue-400" />
            <span>Cron Execution Complete at {new Date(cronSummary.executed_at).toLocaleTimeString()}</span>
          </div>
          <div className="text-slate-300 flex flex-wrap gap-4 pt-1">
            <span>Invoices Generated: <strong>{cronSummary.invoices_generated}</strong></span>
            <span>Emails Dispatched: <strong>{cronSummary.emails_dispatched}</strong></span>
            <span>Rotators Delisted: <strong>{cronSummary.rotators_delisted}</strong></span>
          </div>
        </div>
      )}

      {/* Sponsorship Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 font-bold text-sm text-slate-200">
          Club Sponsorship Tier Renewal Registry
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Sponsor & Billing</th>
                <th className="py-3 px-4">Tier & Price</th>
                <th className="py-3 px-4">Expiration / Countdown</th>
                <th className="py-3 px-4">Renewal Status</th>
                <th className="py-3 px-4">Rotator Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {sponsorships.map((s) => {
                const days = calculateDaysToExpiration(s.expiration_date);

                return (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 space-y-0.5">
                      <div className="font-semibold text-slate-100">{s.sponsor_name}</div>
                      <div className="text-slate-400 flex items-center space-x-1">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{s.billing_email}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                        {s.tier_name} Tier (${s.annual_amount_usd}/yr)
                      </span>
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      <div className="font-medium text-slate-200">
                        {new Date(s.expiration_date).toLocaleDateString()}
                      </div>
                      <div className="text-[11px]">
                        {days > 30 ? (
                          <span className="text-emerald-400 font-medium">{days} days remaining</span>
                        ) : days > 0 ? (
                          <span className="text-amber-400 font-bold flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>Expires in {days} days!</span>
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Expired {-days} days ago</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          s.renewal_status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : s.renewal_status === 'renewal_invoiced_30d'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : s.renewal_status === 'rotator_delisted'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                        }`}
                      >
                        {s.renewal_status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {s.is_active_in_rotator ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-400 font-semibold">
                          <Image className="w-3.5 h-3.5" />
                          <span>Active on Banner</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-rose-400 font-semibold">
                          <span>Delisted / Unlinked</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedInvoice(s)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-[11px] font-medium"
                      >
                        Preview Invoice
                      </button>

                      {s.renewal_status !== 'paid' && (
                        <button
                          onClick={() => onPaySponsorship(s.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition shadow-sm"
                        >
                          Simulate Pay
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="font-bold text-sm flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Stripe Renewal Invoice Preview</span>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-slate-400">Invoice:</span>
                <span>INV-{selectedInvoice.tier_name.toUpperCase()}-{selectedInvoice.id.slice(0, 6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sponsor:</span>
                <span className="font-semibold">{selectedInvoice.sponsor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Package:</span>
                <span>Annual {selectedInvoice.tier_name} Placement</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold text-sm pt-2 border-t border-slate-700">
                <span>Amount Due:</span>
                <span>${selectedInvoice.annual_amount_usd}.00 USD</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Email copy sent to {selectedInvoice.billing_email}: &quot;Your {selectedInvoice.tier_name} Sponsorship with the Tech Club is expiring. Click here to pay and maintain your logo placement.&quot;
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  onPaySponsorship(selectedInvoice.id);
                  setSelectedInvoice(null);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition shadow-md"
              >
                Record Payment Received
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
