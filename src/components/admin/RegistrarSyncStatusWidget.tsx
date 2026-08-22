// =============================================================================
// Component: RegistrarSyncStatusWidget
// Issue: #3691 - Implement 'Automated "Student Status" Registrar Verification'
// Description: Admin widget displaying central LDAP/Registrar sync status, manual
// batch trigger, and account purge audit log history.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  getRegistrarSyncLogs,
  runRegistrarBatchSync,
  type RegistrarSyncLog,
} from "@/services/registrarVerificationService";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import UserX from "lucide-react/dist/esm/icons/user-x";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";

export function RegistrarSyncStatusWidget() {
  const [logs, setLogs] = useState<RegistrarSyncLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ active: number; purged: number } | null>(
    null,
  );

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    const data = await getRegistrarSyncLogs();
    setLogs(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const handleRunManualSync = async () => {
    setIsSyncing(true);
    const res = await runRegistrarBatchSync();
    setLastSyncResult({ active: res.activeCount, purged: res.purgedCount });
    await fetchLogs();
    setIsSyncing(false);
  };

  return (
    <div data-testid="registrar-sync-widget" className="space-y-6 my-6">
      {/* INTEGRATION STATUS BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-indigo-400 shrink-0">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-black text-white">
                  University Registrar Directory Integration
                </h3>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> DAILY SYNC ACTIVE
                </span>
              </div>

              <p className="text-xs md:text-sm text-slate-300 mt-1 leading-relaxed">
                Central identity provider (SAML / Shibboleth / Active Directory LDAP)
                synchronization running nightly. Automatically revokes sessions & locks accounts for
                expelled or inactive students.
              </p>

              {lastSyncResult && (
                <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mt-2">
                  <span>
                    Synced Active:{" "}
                    <strong className="text-emerald-400">{lastSyncResult.active}</strong>
                  </span>
                  <span>
                    Purged Inactive:{" "}
                    <strong className="text-red-400">{lastSyncResult.purged}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunManualSync}
            disabled={isSyncing}
            data-testid="run-registrar-sync-btn"
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing Directory..." : "Run Manual Batch Sync"}</span>
          </button>
        </div>
      </div>

      {/* AUDIT LOG TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <UserX className="w-5 h-5 text-red-400" />
            <div>
              <h4 className="text-base font-bold text-white">Enrollment Security Audit Log</h4>
              <p className="text-xs text-slate-400">
                Log of accounts locked, sessions revoked, and rosters purged due to registrar status
                changes
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-red-950 text-red-300 border border-red-800 rounded-full text-xs font-mono">
            {logs.length} Purged Accounts
          </span>
        </div>

        {isLoading ? (
          <p className="text-xs text-slate-400 font-mono py-4">Loading registrar audit logs...</p>
        ) : logs.length === 0 ? (
          <div
            data-testid="empty-logs-message"
            className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400"
          >
            No purged student accounts recorded. All active users match central university
            enrollment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase">
                  <th className="pb-3">Student ID</th>
                  <th className="pb-3">Student Name</th>
                  <th className="pb-3">Action Taken</th>
                  <th className="pb-3">Clubs Notified</th>
                  <th className="pb-3">Sync Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} data-testid={`registrar-log-row-${log.id}`}>
                    <td className="py-3 font-bold text-slate-100">{log.student_id}</td>
                    <td className="py-3 text-white">{log.user_full_name}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">
                        {log.action_taken}
                      </span>
                    </td>
                    <td className="py-3 text-yellow-300 font-bold">
                      {log.clubs_notified_count} Club Presidents Notified
                    </td>
                    <td className="py-3 text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
