import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { withAuth, WithAuthProps } from "@/hoc/withAuth";
import {
  Mail,
  RefreshCw,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
  ArrowLeft,
  Trash2,
  ShieldAlert,
} from "lucide-react";

interface DqPayload {
  to: string;
  from?: string;
  subject: string;
  body: string;
  fullName?: string;
}

interface DqRecord {
  id: string;
  payload: DqPayload;
  error_message: string | null;
  attempt_count: number;
  created_at: string;
}

function AdminDlqPage({ user }: WithAuthProps) {
  const supabase = createClient();
  const [role, setRole] = useState<string | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [dlqItems, setDlqItems] = useState<DqRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Authenticate role
  useEffect(() => {
    let active = true;
    async function fetchRole() {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile && active) {
          setRole(profile.role);
        }
      } catch (err) {
        console.error("Failed to load user role:", err);
      } finally {
        if (active) setIsRoleLoading(false);
      }
    }
    void fetchRole();
    return () => {
      active = false;
    };
  }, [user.id, supabase]);

  // Load DLQ Items
  const loadDlq = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("dead_letter_queue")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDlqItems(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load dead letter queue.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === "system_admin" || role === "admin") {
      void loadDlq();
    }
  }, [role]);

  // Handle Resend
  const handleResend = async (item: DqRecord) => {
    setResendingId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-welcome-email", {
        body: {
          to: item.payload.to,
          fullName: item.payload.fullName || "CampusConnect Member",
          subject: item.payload.subject,
          body: item.payload.body,
          dlq_id: item.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Email successfully sent to ${item.payload.to}!`);
      // Remove from list
      setDlqItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to resend email.");
    } finally {
      setResendingId(null);
    }
  };

  // Handle Manual Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this item from the queue?")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("dead_letter_queue").delete().eq("id", id);
      if (error) throw error;
      toast.success("Item removed from dead letter queue.");
      setDlqItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete item.");
    } finally {
      setDeletingId(null);
    }
  };

  if (isRoleLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white font-mono">
        Loading admin profile...
      </div>
    );
  }

  if (role !== "system_admin" && role !== "admin") {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6">
          <div className="neu-border mx-auto max-w-2xl bg-white p-8 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-black" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-bold text-black uppercase tracking-tight">
              Admin access required
            </h1>
            <p className="mt-3 font-mono text-sm leading-6 text-gray-700">
              Only system administrators can access the Dead Letter Queue.
            </p>
            <Link
              to="/dashboard"
              className="neu-border inline-block bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream mt-6"
            >
              Return to Dashboard
            </Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="bg-cream min-h-screen">
        <header className="border-b-2 border-black bg-white px-4 py-8">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-black flex items-center gap-3">
                <Mail className="h-9 w-9 text-indigo-600" />
                Dead Letter Queue (DLQ)
              </h1>
              <p className="font-mono text-sm text-gray-600 mt-2">
                Inspect and manually resend failed system email dispatches.
              </p>
            </div>
            <Link
              to="/admin/analytics"
              className="neu-border inline-flex items-center gap-2 bg-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-gray-50 transition-all text-black"
            >
              <ArrowLeft size={14} />
              Back to Analytics
            </Link>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display text-2xl font-bold text-black uppercase">
              Failed Email Deliveries ({dlqItems.length})
            </h2>
            <button
              onClick={() => void loadDlq()}
              disabled={isLoading}
              className="neu-border bg-white p-2 hover:bg-gray-50 disabled:opacity-50 transition-all cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {isLoading ? (
            <div className="neu-border bg-white p-8 text-center font-mono text-sm text-gray-600">
              Loading dead letter queue...
            </div>
          ) : dlqItems.length === 0 ? (
            <div className="neu-border bg-white p-8 text-center font-mono text-sm text-gray-600">
              No failed email dispatches found. The queue is clean!
            </div>
          ) : (
            <div className="space-y-4">
              {dlqItems.map((item) => (
                <article key={item.id} className="neu-border bg-white p-6 relative">
                  <div className="flex flex-col md:flex-row justify-between gap-4 md:items-start">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="neu-border inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                          <AlertTriangle className="h-3 w-3" /> Delivery Failed
                        </span>
                        <span className="font-mono text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 border border-black/10">
                          Attempts: {item.attempt_count}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-black font-display">
                        Subject: {item.payload.subject}
                      </h3>
                      <p className="font-mono text-sm text-black">
                        <strong>To:</strong> {item.payload.to}
                      </p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="neu-border inline-flex items-center gap-1.5 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-black hover:bg-gray-50 cursor-pointer"
                      >
                        {expandedId === item.id ? (
                          <>
                            <EyeOff className="h-4 w-4" /> Hide Body
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" /> View Body
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => void handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="neu-border inline-flex items-center gap-1.5 bg-red-50 px-3 py-1.5 font-mono text-xs font-bold uppercase text-red-600 hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                      <button
                        onClick={() => void handleResend(item)}
                        disabled={resendingId === item.id}
                        className="neu-border inline-flex items-center gap-1.5 bg-black px-4 py-1.5 font-mono text-xs font-bold uppercase text-cream hover:bg-lime hover:text-black disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`h-4 w-4 ${resendingId === item.id ? "animate-spin" : ""}`} />
                        Resend
                      </button>
                    </div>
                  </div>

                  {item.error_message && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-800 font-mono text-xs p-3">
                      <strong>Error Details:</strong> {item.error_message}
                    </div>
                  )}

                  {expandedId === item.id && (
                    <div className="mt-4 border-t border-black/10 pt-4">
                      <h4 className="font-mono text-xs font-bold uppercase text-gray-500 mb-2">
                        Email HTML Body
                      </h4>
                      <div
                        className="border-2 border-black bg-cream p-4 max-h-96 overflow-y-auto overflow-x-hidden font-mono text-xs text-black"
                        dangerouslySetInnerHTML={{ __html: item.payload.body }}
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

export default withAuth(AdminDlqPage);
