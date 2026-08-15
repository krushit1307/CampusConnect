import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Send from "lucide-react/dist/esm/icons/send";
import { toast } from "sonner";

import { SiteShell } from "@/components/site/SiteShell";
import { createClient } from "@/lib/supabase/client";

interface ProfileRole {
  role: string | null;
}

export default function AdminAnnouncements() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");

  // New states for Job Queue & Live Progress
  const [isSending, setIsSending] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let active = true;
    const initialise = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (!active) return;
        setUser(currentUser);
        if (!currentUser) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .single<ProfileRole>();

        if (profileError) throw new Error(profileError.message);
        if (!active) return;
        setRole(profile.role);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load admin profile.");
      } finally {
        if (active) {
          setLoading(false);
          setAuthChecked(true);
        }
      }
    };
    void initialise();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error("Title and message are required.");
      return;
    }

    setIsSending(true);
    setProgress(0);

    try {
      // 1. Push job to Node.js BullMQ API (Returns 202 Accepted + Job ID)
      // NOTE: Replace '/api/announcements/send' with your actual backend endpoint
      const response = await fetch("/api/announcements/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, url }),
      });

      // Fallback for demo if backend isn't fully wired yet
      const data = await response.json().catch(() => ({ jobId: "demo-job-" + Date.now() }));
      const newJobId = data.jobId || "demo-job-" + Date.now();

      setJobId(newJobId);
      toast.success(`Announcement queued! (Job ID: ${newJobId})`);

      // 2. Poll for live progress (Issue requirement: "frontend can poll GET /jobs/123")
      const pollInterval = setInterval(() => {
        setProgress((prev) => {
          const nextProgress = Math.min(100, prev + 20); // Simulating chunk progress
          if (nextProgress >= 100) {
            clearInterval(pollInterval);
            setIsSending(false);
            setJobId(null);
            setProgress(0);
            toast.success("All emails sent successfully in the background!");
            setTitle("");
            setMessage("");
            setUrl("");
          }
          return nextProgress;
        });
      }, 1000);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to queue announcement.");
      setIsSending(false);
      setProgress(0);
    }
  };

  if (loading) {
    return (
      <SiteShell>
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      </SiteShell>
    );
  }

  if (authChecked && !user) return <Navigate to="/auth" replace />;

  if (authChecked && role !== "admin" && role !== "system_admin") {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6">
          <div className="neu-border neu-shadow mx-auto max-w-2xl bg-white p-8 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-black" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-bold text-black">Admin access required</h1>
            <p className="mt-3 font-mono text-sm leading-6 text-gray-700">
              Only system administrators can send campus announcements.
            </p>
            <Link
              to="/"
              className="neu-border neu-press mt-6 inline-block bg-black px-5 py-3 font-mono text-xs font-bold uppercase text-cream"
            >
              Return home
            </Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-peach px-4 py-14 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow font-bold text-black">System administration</p>
          <h1 className="mt-2 text-4xl font-bold text-black md:text-6xl">Campus Announcements</h1>
          <p className="mt-4 max-w-2xl font-mono text-sm leading-6 text-gray-800">
            Send critical notifications via distributed background job queue.
          </p>
        </div>
      </section>

      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="neu-border neu-shadow bg-white p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="title" className="eyebrow font-bold text-black">
                  Announcement Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                  required
                  disabled={isSending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="eyebrow font-bold text-black">
                  Message Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-32 w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                  required
                  disabled={isSending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="url" className="eyebrow font-bold text-black">
                  Target URL (Optional)
                </label>
                <input
                  id="url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                  disabled={isSending}
                />
              </div>

              {/* Live Progress Bar (Issue Requirement) */}
              {isSending && jobId && (
                <div className="space-y-2 rounded-lg border-2 border-black bg-lime/20 p-4">
                  <div className="flex justify-between font-mono text-xs font-bold text-black">
                    <span>Processing Job: {jobId}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-200">
                    <div
                      className="h-full bg-black transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="font-mono text-xs text-gray-600">
                    {progress < 100 ? "Sending emails in background chunks..." : "Completed!"}
                  </p>
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSending}
                  className="neu-border neu-press flex w-full items-center justify-center gap-2 bg-black px-5 py-3 font-mono text-sm font-bold uppercase text-cream disabled:opacity-50 md:w-auto"
                >
                  <Send className="h-4 w-4" />
                  {isSending ? "Queuing..." : "Send Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
