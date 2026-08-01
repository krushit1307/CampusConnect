import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkle } from "@/components/site/Sparkle";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrengthMeter, getPasswordStrength } from "@/components/ui/password-strength";
import { ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useExperimentStore } from "@/store/useExperimentStore";
import { sendVerificationEmail } from "@/lib/email/service";
import { getFriendlyAuthError } from "@/utils/authErrors";
import { PasskeyLoginButton } from "@/components/PasskeyLoginButton";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { Turnstile } from "@marsidev/react-turnstile";
import { AuthSocialProviderGrid } from "@/components/auth/AuthSocialProviderGrid";
import { PasskeyAuthModal } from "@/components/auth/PasskeyAuthModal";
import {
  signInSchema,
  type SignInFormValues,
  signUpSchema,
  type SignUpFormValues,
} from "@/lib/schemas";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const navigate = useNavigate();
  const supabase = createClient();
  const { registerPasskey } = useWebAuthn();

  const signInForm = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const signUpPassword = signUpForm.watch("password");

function switchMode(nextMode: "signin" | "signup") {
  setMode(nextMode);
  setError(null);
  setCaptchaToken("");
  signInForm.reset();
  signUpForm.reset();
}

  async function onSignIn(values: SignInFormValues) {
    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("login-proxy", {
        body: { email: values.email, password: values.password },
      });

      if (invokeError) {
        const body = await invokeError.context?.json().catch(() => null);
        const status = invokeError.status || invokeError.context?.status;
        if (status === 429) {
          const retryAfterSeconds = body?.retryAfter || 900;
          const minutes = Math.ceil(retryAfterSeconds / 60);
          throw new Error(`Account locked, try again in ${minutes} minutes`);
        }
        throw new Error(body?.error || invokeError.message);
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (setSessionError) throw setSessionError;

      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const message = getFriendlyAuthError(err);

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }
  async function onSignUp(values: SignUpFormValues) {
    setLoading(true);
    setError(null);

    try {
      if (!captchaToken) {
    toast.error("Please complete CAPTCHA verification.");
    setLoading(false);
    return;
}
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            captcha_token: captchaToken,
            first_name: values.firstName,
            last_name: values.lastName,
            full_name: `${values.firstName} ${values.lastName}`.trim(),
            newsletter_opt_in: values.newsletterOptIn,
          },
        },
      });

      if (signUpError) throw signUpError;

      toast.success("Account created! A verification link has been sent to your email.");
      setCaptchaToken("");
      if (signUpData?.session) {
        try {
          const enrolled = await registerPasskey("Passkey");
          if (enrolled) {
            toast.success("Passkey registered successfully!");
            setCaptchaToken("");
          }
        } catch (e) {
          console.error("Passkey enrollment skipped or failed", e);
        }
      }

      // Track registration A/B variant telemetry
      useExperimentStore.getState().trackRegistration();

      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const message = getFriendlyAuthError(err);

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      const message = getFriendlyAuthError(err);

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-purple-300 px-4 py-16">
      <Sparkle className="absolute left-8 top-8" size={20} />
      <Sparkle className="absolute right-8 top-8" size={20} />
      <Sparkle className="absolute bottom-8 left-8" size={16} />
      <Sparkle className="absolute bottom-8 right-8" size={16} />

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-bold text-black">
            CAMPUS
            <span className="bg-black px-1 text-white">CONNECT</span>
          </Link>

          <Link
            to="/"
            className="neu-border flex items-center gap-1.5 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-black transition-colors hover:bg-black hover:text-cream cursor-pointer"
            aria-label="Return to Home page"
          >
            <ArrowLeft size={14} />
            Home
          </Link>
        </div>

        <div className="neu-border bg-white p-8">
          <div key={mode} className="auth-mode-transition">
            <p className="eyebrow mb-2 font-bold text-black">
              {mode === "signin" ? "Welcome back" : "Get started"}
            </p>

            <h1 className="mb-6 text-3xl font-bold text-black">
              {mode === "signin" ? "Sign in to CampusConnect" : "Create your account"}
            </h1>

            {error && (
              <div role="alert" className="mb-4 bg-red-100 p-2 font-mono text-sm text-red-800">
                {error}
              </div>
            )}

            {mode === "signin" ? (
              <Form {...signInForm}>
                <form
                  onSubmit={signInForm.handleSubmit(onSignIn)}
                  className="space-y-4 text-black"
                  noValidate
                >
                  <FormField
                    control={signInForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required className="eyebrow font-bold text-black">
                          College email
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@college.edu"
                            autoComplete="username"
                            className="w-full rounded-none border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus-visible:ring-0 focus-within:bg-lime/40"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signInForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required className="eyebrow font-bold text-black">
                          Password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder="********"
                            autoComplete="current-password"
                            className="px-1 py-2 font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p className="text-right">
                    <Link
                      to="/forgot-password"
                      className="font-mono text-xs font-bold text-blue-700 underline underline-offset-2 cursor-pointer"
                    >
                      Forgot password?
                    </Link>
                  </p>

                  <Button
                    type="submit"
                    disabled={loading}
                    variant="primary"
                    className="w-full bg-black text-cream hover:bg-black/90 cursor-pointer shadow-[3px_3px_0_0_var(--color-ink)]"
                  >
                    {loading ? "Loading..." : "Sign in"}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...signUpForm}>
                <form
                  onSubmit={signUpForm.handleSubmit(onSignUp)}
                  className="space-y-4 text-black"
                  noValidate
                >
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={signUpForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required className="eyebrow font-bold text-black">
                            First name
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="Ada"
                              autoComplete="given-name"
                              className="w-full rounded-none border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus-visible:ring-0 focus-within:bg-lime/40"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required className="eyebrow font-bold text-black">
                            Last name
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="Lovelace"
                              autoComplete="family-name"
                              className="w-full rounded-none border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus-visible:ring-0 focus-within:bg-lime/40"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={signUpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required className="eyebrow font-bold text-black">
                          College email
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@college.edu"
                            autoComplete="email"
                            className="w-full rounded-none border-0 border-b-2 border-black bg-transparent px-1 py-2 font-mono text-sm outline-none focus-visible:ring-0 focus-within:bg-lime/40"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required className="eyebrow font-bold text-black">
                          Password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder="********"
                            autoComplete="new-password"
                            className="px-1 py-2 font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        {signUpPassword && <PasswordStrengthMeter password={signUpPassword} />}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required className="eyebrow font-bold text-black">
                          Confirm password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder="********"
                            autoComplete="new-password"
                            className="px-1 py-2 font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="newsletterOptIn"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-neutral-200 p-4 shadow-[2px_2px_0_0_var(--color-ink)]">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-bold text-black cursor-pointer">
                            Subscribe to newsletter
                          </FormLabel>
                          <p className="text-sm text-neutral-500">
                            Get updates on campus events and club activities.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
<Turnstile
    siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
    onSuccess={(token) => setCaptchaToken(token)}
    onExpire={() => setCaptchaToken("")}
    onError={() => setCaptchaToken("")}
/>
                  <Turnstile
  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
  onSuccess={(token) => setCaptchaToken(token)}
  onExpire={() => setCaptchaToken("")}
  onError={() => setCaptchaToken("")}
/>

{captchaToken && (
  <p className="text-green-600 text-sm">
    CAPTCHA verified
  </p>
)}
                  <Button
                    type="submit"
                    disabled={
    loading ||
    !captchaToken ||
    getPasswordStrength(signUpPassword) === "weak"
}
                    variant="primary"
                    className="w-full bg-black text-cream hover:bg-black/90 cursor-pointer shadow-[3px_3px_0_0_var(--color-ink)]"
                  >
                    {loading ? "Loading..." : "Create account"}
                  </Button>
                </form>
              </Form>
            )}

            <div className="my-6 flex items-center gap-3">
              <div className="h-[2px] flex-1 bg-black" />
              <span className="eyebrow font-bold text-black">or sign in with</span>
              <div className="h-[2px] flex-1 bg-black" />
            </div>

            <AuthSocialProviderGrid
              onPasskeyClick={() => setIsPasskeyModalOpen(true)}
              onMagicLinkSent={() => toast.info("Check your email to complete login.")}
            />

            <PasskeyAuthModal
              isOpen={isPasskeyModalOpen}
              onClose={() => setIsPasskeyModalOpen(false)}
              onSuccess={() => navigate("/dashboard", { replace: true })}
            />

            {mode === "signin" && (
              <div className="mt-3">
                <PasskeyLoginButton
                  disabled={loading}
                  onSuccess={() => navigate("/dashboard", { replace: true })}
                  onError={(msg) => {
                    setError(msg);
                    toast.error(msg);
                  }}
                />
              </div>
            )}

            <p className="mt-6 text-center font-mono text-xs text-black">
              {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
              <Button
                type="button"
                variant="link"
                onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                className="h-auto p-0 font-bold underline text-blue-700 cursor-pointer"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </Button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
