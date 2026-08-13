import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import KeyRound from "lucide-react/dist/esm/icons/key-round";
import Mail from "lucide-react/dist/esm/icons/mail";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Globe from "lucide-react/dist/esm/icons/globe";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getFriendlyAuthError } from "@/utils/authErrors";

interface AuthSocialProviderGridProps {
  onPasskeyClick?: () => void;
  onMagicLinkSent?: (email: string) => void;
}

export const AuthSocialProviderGrid: React.FC<AuthSocialProviderGridProps> = ({
  onPasskeyClick,
  onMagicLinkSent,
}) => {
  const supabase = createClient();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [showSsoDrawer, setShowSsoDrawer] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [ssoDomain, setSsoDomain] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleOAuthLogin = async (provider: "google" | "github" | "azure" | "apple") => {
    setLoadingProvider(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as "google" | "github",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const msg = getFriendlyAuthError(err);
      toast.error(msg);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail || !magicEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoadingProvider("magic-link");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: magicEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      toast.success("Magic Sign-in Link dispatched to your inbox!");
      onMagicLinkSent?.(magicEmail);
    } catch (err: unknown) {
      const msg = getFriendlyAuthError(err);
      toast.error(msg);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleSsoRedirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoDomain) return;
    toast.info(`Redirecting to ${ssoDomain} Enterprise Single Sign-On (SSO)...`);
  };

  return (
    <div className="space-y-4">
      {/* Primary Social SSO Grid */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => handleOAuthLogin("google")}
          className="border-2 border-black bg-white text-black hover:bg-yellow-100 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase transition-colors cursor-pointer shadow-[3px_3px_0_0_var(--color-ink)]"
        >
          <span className="text-base">🌐</span>
          <span>Google SSO</span>
        </Button>

        <Button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => handleOAuthLogin("github")}
          className="border-2 border-black bg-black text-cream hover:bg-cream hover:text-black flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase transition-colors cursor-pointer shadow-[3px_3px_0_0_var(--color-ink)]"
        >
          <span className="text-base">🐙</span>
          <span>GitHub SSO</span>
        </Button>

        <Button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => handleOAuthLogin("azure")}
          className="border-2 border-black bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase transition-colors cursor-pointer shadow-[3px_3px_0_0_var(--color-ink)]"
        >
          <span className="text-base">🏢</span>
          <span>Microsoft</span>
        </Button>

        <Button
          type="button"
          disabled={loadingProvider !== null}
          onClick={onPasskeyClick}
          className="border-2 border-black bg-purple-200 text-black hover:bg-purple-300 flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase transition-colors cursor-pointer shadow-[3px_3px_0_0_var(--color-ink)]"
        >
          <KeyRound className="h-4 w-4 text-purple-900" />
          <span>Passkey</span>
        </Button>
      </div>

      {/* Alternative Options Drawer Toggles */}
      <div className="flex justify-between items-center pt-2 font-mono text-xs">
        <button
          type="button"
          onClick={() => {
            setShowMagicLink(!showMagicLink);
            setShowSsoDrawer(false);
          }}
          className="font-bold underline text-blue-800 hover:text-black cursor-pointer flex items-center gap-1"
        >
          <Mail className="h-3.5 w-3.5" />
          {showMagicLink ? "Hide Magic Link" : "Email Magic Link"}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowSsoDrawer(!showSsoDrawer);
            setShowMagicLink(false);
          }}
          className="font-bold underline text-gray-800 hover:text-black cursor-pointer flex items-center gap-1"
        >
          <Globe className="h-3.5 w-3.5" />
          {showSsoDrawer ? "Hide Enterprise SSO" : "Campus SSO Domain"}
        </button>
      </div>

      {/* Magic Link Direct Access Form */}
      {showMagicLink && (
        <form
          onSubmit={handleSendMagicLink}
          className="p-3 border-2 border-black bg-amber-50 space-y-2"
        >
          <p className="font-mono text-xs font-bold uppercase text-amber-900">
            Passwordless Magic Link
          </p>
          {magicLinkSent ? (
            <div className="flex items-center gap-2 p-2 border border-black bg-green-100 font-mono text-xs text-green-900">
              <CheckCircle2 className="h-4 w-4 text-green-700 shrink-0" />
              <span>Check your inbox for the sign-in URL.</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="student@university.edu"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                className="border border-black font-mono text-xs bg-white"
              />
              <Button
                type="submit"
                disabled={loadingProvider === "magic-link"}
                className="border-2 border-black bg-black text-cream font-mono text-xs font-bold uppercase"
              >
                Send <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </form>
      )}

      {/* Enterprise SSO Domain Input Drawer */}
      {showSsoDrawer && (
        <form
          onSubmit={handleSsoRedirect}
          className="p-3 border-2 border-black bg-sky/30 space-y-2"
        >
          <p className="font-mono text-xs font-bold uppercase text-black">
            University / Enterprise Domain SAML SSO
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="e.g. Stanford.edu"
              value={ssoDomain}
              onChange={(e) => setSsoDomain(e.target.value)}
              className="border border-black font-mono text-xs bg-white"
            />
            <Button
              type="submit"
              disabled={!ssoDomain}
              className="border-2 border-black bg-black text-cream font-mono text-xs font-bold uppercase"
            >
              Continue SSO
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
