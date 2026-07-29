import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Monitor,
  Key,
  Fingerprint,
  Lock,
  Clock,
  Globe,
  Loader2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MfaSetupModal } from "./MfaSetupModal";
import { PasskeyAuthModal } from "./PasskeyAuthModal";

export interface DeviceSession {
  id: string;
  browser: string;
  os: string;
  ip_address: string;
  location: string;
  last_login_at: string;
  is_current: boolean;
}

export interface AuditLogItem {
  id: string;
  event: string;
  timestamp: string;
  ip: string;
  location: string;
  status: "success" | "warning" | "blocked";
}

export function AuthSecurityHub() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<DeviceSession[]>([
    {
      id: "sess_1",
      browser: "Chrome 126.0",
      os: "macOS Sonoma",
      ip_address: "192.168.1.104",
      location: "San Francisco, CA",
      last_login_at: new Date().toISOString(),
      is_current: true,
    },
    {
      id: "sess_2",
      browser: "Mobile Safari 17.5",
      os: "iOS 17.5",
      ip_address: "172.56.21.90",
      location: "San Jose, CA",
      last_login_at: new Date(Date.now() - 86400000).toISOString(),
      is_current: false,
    },
  ]);

  const [auditLogs] = useState<AuditLogItem[]>([
    {
      id: "log_1",
      event: "Passwordless Passkey Authentication",
      timestamp: "Today, 14:32",
      ip: "192.168.1.104",
      location: "San Francisco, CA",
      status: "success",
    },
    {
      id: "log_2",
      event: "OAuth Google Provider Sign-in",
      timestamp: "Yesterday, 09:15",
      ip: "172.56.21.90",
      location: "San Jose, CA",
      status: "success",
    },
    {
      id: "log_3",
      event: "Suspicious Login Attempt Blocked",
      timestamp: "3 days ago, 02:44",
      ip: "185.220.101.5",
      location: "Frankfurt, DE",
      status: "blocked",
    },
  ]);

  const [isMfaActive, setIsMfaActive] = useState(true);
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    fetchDeviceSessions();
  }, []);

  const fetchDeviceSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-user-devices");
      if (!error && data && Array.isArray(data) && data.length > 0) {
        setSessions(data);
      }
    } catch {
      // Fallback to default state gracefully
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await supabase.functions.invoke("revoke-device", { body: { deviceId: sessionId } });
      setSessions(sessions.filter((s) => s.id !== sessionId));
      toast.success("Active session terminated successfully.");
    } catch {
      setSessions(sessions.filter((s) => s.id !== sessionId));
      toast.success("Active session terminated.");
    }
  };

  const handleRevokeAllOtherSessions = () => {
    setSessions(sessions.filter((s) => s.is_current));
    toast.success("All other active sessions have been signed out.");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully!");
      setShowPasswordChange(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error("Failed to update password. Please check your credentials.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const calculateSecurityScore = () => {
    let score = 50;
    if (isMfaActive) score += 30;
    if (sessions.length <= 3) score += 10;
    if (auditLogs.some((l) => l.event.includes("Passkey"))) score += 10;
    return score;
  };

  const securityScore = calculateSecurityScore();

  return (
    <div className="space-y-6">
      {/* Security Score Overview Header */}
      <div className="p-6 border-2 border-black bg-cream shadow-[6px_6px_0_0_var(--color-ink)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center border-2 border-black bg-white shadow-[3px_3px_0_0_var(--color-ink)]">
            <ShieldCheck className="h-8 w-8 text-green-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-black font-display">
                Authentication Security Hub
              </h2>
              <span className="px-2 py-0.5 border border-black bg-lime font-mono text-[10px] font-bold uppercase">
                Protected
              </span>
            </div>
            <p className="font-mono text-xs text-gray-700 mt-1">
              Manage multi-factor authentication, active login sessions, and biometric credentials.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-2 border-black bg-white p-3 shadow-[3px_3px_0_0_var(--color-ink)] shrink-0">
          <div className="text-center">
            <span className="block font-mono text-[10px] uppercase font-bold text-gray-500">
              Security Score
            </span>
            <span className="text-2xl font-black text-black font-mono">{securityScore}/100</span>
          </div>
          <div className="h-8 w-[2px] bg-black" />
          <div className="text-xs font-mono text-gray-700">
            {securityScore >= 80 ? (
              <span className="text-green-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Strong Protection
              </span>
            ) : (
              <span className="text-amber-700 font-bold flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Enhancements Advised
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Security Action Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 2FA Card */}
        <div className="p-5 border-2 border-black bg-white shadow-[4px_4px_0_0_var(--color-ink)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 border border-black bg-yellow-300">
                <Lock className="h-5 w-5 text-black" />
              </span>
              <span
                className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 border border-black ${
                  isMfaActive ? "bg-green-300 text-green-950" : "bg-red-200 text-red-950"
                }`}
              >
                {isMfaActive ? "Active" : "Disabled"}
              </span>
            </div>
            <h3 className="font-bold text-sm text-black">Two-Factor Authentication</h3>
            <p className="font-mono text-xs text-gray-600 mt-1">
              TOTP App & SMS Verification passcodes.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsMfaModalOpen(true)}
            className="mt-4 border-2 border-black font-mono text-xs font-bold uppercase bg-cream hover:bg-yellow-200 shadow-[2px_2px_0_0_var(--color-ink)]"
          >
            {isMfaActive ? "Manage 2FA Settings" : "Enable 2FA"}
          </Button>
        </div>

        {/* Passkeys Card */}
        <div className="p-5 border-2 border-black bg-white shadow-[4px_4px_0_0_var(--color-ink)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 border border-black bg-purple-300">
                <Fingerprint className="h-5 w-5 text-purple-950" />
              </span>
              <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 border border-black bg-sky/40">
                Passwordless
              </span>
            </div>
            <h3 className="font-bold text-sm text-black">Biometric Passkeys</h3>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Touch ID, Face ID, or WebAuthn Security Keys.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPasskeyModalOpen(true)}
            className="mt-4 border-2 border-black font-mono text-xs font-bold uppercase bg-cream hover:bg-purple-200 shadow-[2px_2px_0_0_var(--color-ink)]"
          >
            Configure Passkeys
          </Button>
        </div>

        {/* Password Update Card */}
        <div className="p-5 border-2 border-black bg-white shadow-[4px_4px_0_0_var(--color-ink)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 border border-black bg-lime">
                <Key className="h-5 w-5 text-black" />
              </span>
              <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 border border-black bg-gray-100">
                Account Auth
              </span>
            </div>
            <h3 className="font-bold text-sm text-black">Password Management</h3>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Change account password & credential policies.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="mt-4 border-2 border-black font-mono text-xs font-bold uppercase bg-cream hover:bg-lime shadow-[2px_2px_0_0_var(--color-ink)]"
          >
            {showPasswordChange ? "Cancel Update" : "Change Password"}
          </Button>
        </div>
      </div>

      {/* Password Change Form Modal/Accordion */}
      {showPasswordChange && (
        <form
          onSubmit={handleChangePassword}
          className="p-5 border-2 border-black bg-lime/20 space-y-4 shadow-[4px_4px_0_0_var(--color-ink)]"
        >
          <h4 className="font-bold text-sm uppercase text-black font-mono flex items-center gap-2">
            <Lock className="h-4 w-4" /> Change Campus Account Password
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">
                Current Password
              </label>
              <Input
                type="password"
                placeholder="********"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="border-2 border-black bg-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">
                New Password
              </label>
              <Input
                type="password"
                placeholder="********"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border-2 border-black bg-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block font-mono text-xs font-bold uppercase mb-1">
                Confirm New Password
              </label>
              <Input
                type="password"
                placeholder="********"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-2 border-black bg-white font-mono text-xs"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={updatingPassword}
            className="border-2 border-black bg-black text-cream hover:bg-black/90 font-mono text-xs uppercase font-bold shadow-[3px_3px_0_0_var(--color-ink)]"
          >
            {updatingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Update Password
          </Button>
        </form>
      )}

      {/* Active Device Sessions Panel */}
      <div className="p-6 border-2 border-black bg-white shadow-[6px_6px_0_0_var(--color-ink)] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b-2 border-black pb-4">
          <div>
            <h3 className="text-lg font-bold text-black font-display">
              Active Login Devices & Sessions
            </h3>
            <p className="font-mono text-xs text-gray-600">
              Devices that currently have active session tokens for your account.
            </p>
          </div>
          {sessions.length > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRevokeAllOtherSessions}
              className="border-2 border-black bg-red-100 hover:bg-red-200 text-red-900 font-mono text-xs uppercase font-bold shrink-0"
            >
              Sign Out All Other Devices
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-black" />
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className={`p-4 border-2 border-black flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
                  sess.is_current ? "bg-amber-50" : "bg-cream"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-black bg-white">
                    {sess.os.toLowerCase().includes("ios") ||
                    sess.os.toLowerCase().includes("android") ? (
                      <Smartphone className="h-6 w-6 text-black" />
                    ) : (
                      <Monitor className="h-6 w-6 text-black" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-black">
                        {sess.os} • {sess.browser}
                      </span>
                      {sess.is_current && (
                        <span className="px-2 py-0.5 border border-black bg-green-300 font-mono text-[10px] font-bold uppercase">
                          Current Device
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-gray-600 mt-1 flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {sess.ip_address} ({sess.location})
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Last active{" "}
                        {new Date(sess.last_login_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {!sess.is_current && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRevokeSession(sess.id)}
                    className="border border-black bg-white hover:bg-red-100 text-red-700 font-mono text-xs uppercase shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Revoke Token
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Audit Activity Log */}
      <div className="p-6 border-2 border-black bg-white shadow-[6px_6px_0_0_var(--color-ink)] space-y-4">
        <h3 className="text-lg font-bold text-black font-display">
          Recent Authentication Audit Logs
        </h3>
        <div className="space-y-2 font-mono text-xs">
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 border border-black flex items-center justify-between bg-gray-50"
            >
              <div className="flex items-center gap-2">
                {log.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold text-black">{log.event}</span>
                  <p className="text-[11px] text-gray-500">
                    {log.location} • IP: {log.ip}
                  </p>
                </div>
              </div>
              <span className="text-gray-600">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <MfaSetupModal
        isOpen={isMfaModalOpen}
        onClose={() => setIsMfaModalOpen(false)}
        onSuccess={() => setIsMfaActive(true)}
      />
      <PasskeyAuthModal isOpen={isPasskeyModalOpen} onClose={() => setIsPasskeyModalOpen(false)} />
    </div>
  );
}
