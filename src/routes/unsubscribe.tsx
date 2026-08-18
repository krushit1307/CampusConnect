// src/routes/unsubscribe.tsx
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MailX, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewsletterService } from "@/services/newsletterService";
import { createClient } from "@/lib/supabase/client";

export default function UnsubscribeRoute() {
  const [searchParams] = useSearchParams();
  const clubId = searchParams.get("clubId");

  const [email, setEmail] = useState("");
  const [clubName, setClubName] = useState("");
  const [loading, setLoading] = useState(true);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.email) {
          setEmail(sessionData.session.user.email);
        }

        if (clubId) {
          const { data: club } = await supabase
            .from("clubs")
            .select("name")
            .eq("id", clubId)
            .maybeSingle();

          if (club) {
            setClubName(club.name);
          }
        }
      } catch (err) {
        console.error("Unsubscribe route error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [clubId]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubId || !email.trim()) {
      setError("Club ID and valid email address are required.");
      return;
    }

    try {
      setUnsubscribing(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      await NewsletterService.unsubscribeFromClubNewsletter(clubId, email, userId);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to unsubscribe.");
    } finally {
      setUnsubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-mono text-xs">
        <div className="neu-border p-6 bg-white flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading unsubscribe details…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="neu-border bg-white p-8 max-w-md w-full space-y-6 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3 border-b-2 border-black pb-4">
          <MailX className="h-8 w-8 text-amber-600 shrink-0" />
          <div>
            <h1 className="font-display text-xl font-bold uppercase tracking-tight text-black">
              Unsubscribe Preference
            </h1>
            <p className="font-mono text-xs text-gray-500 mt-0.5">
              CampusConnect Club Newsletter Settings
            </p>
          </div>
        </div>

        {success ? (
          <div className="space-y-4 font-mono text-xs">
            <div className="flex items-center gap-3 p-4 bg-green-100 border-2 border-green-800 text-green-950 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <CheckCircle2 className="h-6 w-6 text-green-700 shrink-0" />
              <div>
                <p className="font-bold uppercase">Unsubscribed Successfully</p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  You will no longer receive promotional newsletters from{" "}
                  <strong>{clubName || "this club"}</strong>.
                </p>
              </div>
            </div>

            <p className="text-gray-600 text-[11px]">
              Note: This preference strictly applies to club marketing newsletters. Critical account
              security, RSVP, and platform alerts will still be delivered safely.
            </p>
          </div>
        ) : (
          <form onSubmit={handleUnsubscribe} className="space-y-4 font-mono text-xs">
            <p className="text-gray-700">
              Unsubscribe <strong>{email || "your email"}</strong> from newsletters sent by{" "}
              <strong>{clubName || "this club"}</strong>?
            </p>

            {error && (
              <div className="p-3 bg-red-100 border border-red-600 text-red-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div>
              <label className="block font-bold mb-1">Confirm Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@university.edu"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={unsubscribing}
              className="w-full neu-border bg-black text-white hover:bg-zinc-800 font-mono text-xs font-bold uppercase py-2.5"
            >
              {unsubscribing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Unsubscribe
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
