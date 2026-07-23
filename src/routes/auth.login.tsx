import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";

export default function AuthLogin() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setLoading(true);
    setErrorMsg("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to authenticate with provider";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteShell>
      <div className="flex min-h-[70vh] items-center justify-center bg-cream px-4 py-12">
        <div className="neu-border w-full max-w-md bg-white p-8 shadow-[8px_8px_0_0_var(--color-ink)]">
          <h1 className="text-3xl font-bold text-black mb-2">Welcome Back</h1>
          <p className="font-mono text-xs text-gray-600 mb-6">
            Sign in to your CampusConnect account
          </p>

          {errorMsg && (
            <div className="mb-4 neu-border bg-peach p-3 font-mono text-xs text-black">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuthLogin("google")}
              className="neu-border neu-press w-full flex items-center justify-center gap-3 bg-white py-3 font-mono text-sm font-bold uppercase text-black hover:bg-sky transition-colors cursor-pointer"
            >
              <span>🌐</span> Login with Google
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuthLogin("github")}
              className="neu-border neu-press w-full flex items-center justify-center gap-3 bg-black py-3 font-mono text-sm font-bold uppercase text-cream hover:bg-cream hover:text-black transition-colors cursor-pointer"
            >
              <span>🐙</span> Login with GitHub
            </button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
