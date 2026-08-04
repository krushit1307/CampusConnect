import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { ShieldAlert, Send } from "lucide-react";
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
  const [isSending, setIsSending] = useState(false);

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

    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: { title, message, url },
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success(
        `Announcement sent! Successful: ${data.successCount}, Removed: ${data.removedCount}, Errors: ${data.errorCount}`,
      );
      setTitle("");
      setMessage("");
      setUrl("");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to send announcement.");
    } finally {
      setIsSending(false);
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

  if (authChecked && !user) {
    return <Navigate to="/auth" replace />;
  }

  // Assuming 'admin' or 'system_admin' role, matching the edge function which checks for 'admin'
  // I will check for 'admin' or 'system_admin'
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
            Send critical push notifications to all opted-in students.
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
                  placeholder="e.g., Campus Closure Alert"
                  className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                  required
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
                  placeholder="Enter the details of the announcement..."
                  className="min-h-32 w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                  required
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
                  placeholder="e.g., /announcements or https://example.com"
                  className="w-full border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus:bg-lime/40"
                />
                <p className="font-mono text-xs text-gray-500">
                  Where users will be redirected when they click the notification.
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSending}
                  className="neu-border neu-press flex w-full items-center justify-center gap-2 bg-black px-5 py-3 font-mono text-sm font-bold uppercase text-cream disabled:opacity-50 md:w-auto"
                >
                  <Send className="h-4 w-4" />
                  {isSending ? "Sending..." : "Send Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
