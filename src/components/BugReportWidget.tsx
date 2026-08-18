import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Bug from "lucide-react/dist/esm/icons/bug";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import type { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function BugReportWidget() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // If user is not authenticated, we do not render the widget
  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Please enter a description for the bug.");
      return;
    }

    if (description.length > 2000) {
      toast.error("Description must be 2000 characters or less.");
      return;
    }

    // Rate Limiting Check (30 seconds)
    const LAST_SUBMIT_KEY = `cc-bug-submit-${user.id}`;
    const lastSubmit = localStorage.getItem(LAST_SUBMIT_KEY);
    if (lastSubmit) {
      const elapsed = Date.now() - parseInt(lastSubmit, 10);
      if (elapsed < 30000) {
        const remaining = Math.ceil((30000 - elapsed) / 1000);
        toast.error(`Please wait ${remaining}s before submitting another report.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("bug_reports").insert({
        user_id: user.id,
        description: description.trim(),
        url: window.location.href,
        user_agent: navigator.userAgent,
      });

      if (error) throw error;

      localStorage.setItem(LAST_SUBMIT_KEY, Date.now().toString());
      toast.success("Thank you for the feedback!");
      setDescription("");
      setOpen(false);
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Failed to submit bug report.";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          aria-label="Report a bug"
          className="fixed bottom-6 left-6 z-40 flex h-12 w-12 cursor-pointer items-center justify-center border-2 border-black bg-brand-yellow-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:bg-yellow-500"
        >
          <Bug className="h-6 w-6 text-black" />
        </button>
      </DialogTrigger>
      <DialogContent className="border-2 border-black bg-cream p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none max-w-md dark:bg-brand-gray-base-800 dark:border-cream dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
        <DialogHeader className="font-mono text-black dark:text-cream">
          <DialogTitle className="text-xl font-bold uppercase flex items-center gap-2">
            <Bug className="h-5 w-5 text-peach dark:text-yellow-500" />
            Report a Bug
          </DialogTitle>
          <DialogDescription className="text-xs uppercase font-bold text-gray-600 dark:text-gray-400 mt-1">
            Help us improve the CampusConnect beta phase. Describe the issue below.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="mt-4 font-mono space-y-4 text-black dark:text-cream"
        >
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider">Bug Description</label>
            <Textarea
              placeholder="What went wrong? Please describe step-by-step..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              className="min-h-[120px] bg-white border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] placeholder:text-gray-400 focus-visible:ring-0 focus-visible:outline-none dark:bg-black dark:border-cream dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
            />
          </div>

          <div className="bg-gray-100 dark:bg-brand-gray-base-900 border border-black dark:border-cream p-3 text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400 space-y-1">
            <div>
              Captured URL:{" "}
              <span className="text-black dark:text-cream break-all">
                {window.location.pathname}
              </span>
            </div>
            <div>
              User Agent:{" "}
              <span className="text-black dark:text-cream break-all">
                {navigator.userAgent.substring(0, 80)}...
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-peach hover:-translate-y-0.5 active:translate-y-0 border-2 border-black font-bold uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none cursor-pointer flex items-center justify-center gap-2 text-black dark:bg-amber-600 dark:border-cream dark:text-cream dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Report"
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
