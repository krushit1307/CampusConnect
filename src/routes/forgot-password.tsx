import { Link } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck, Send, ShieldCheck } from "lucide-react";
import { Sparkle } from "@/components/site/Sparkle";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getFriendlyAuthError } from "@/utils/authErrors";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/schemas";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClient();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setLoading(true);
    setError(null);

    try {
      const { error: invokeError } = await supabase.functions.invoke("request-password-reset", {
        body: {
          email: values.email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });

      if (invokeError) {
        const body = await invokeError.context?.json().catch(() => null);
        throw new Error(body?.error || invokeError.message);
      }

      // Always show the same success state, whether or not the email exists,
      // so we don't leak which addresses have an account.
      setSubmitted(true);
    } catch (err: unknown) {
      const message = getFriendlyAuthError(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-20 top-16 h-48 w-48 rounded-full bg-peach blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-20 h-56 w-56 rounded-full bg-lime blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-8 h-28 w-28 -translate-x-1/2 rounded-full bg-amber-300/50 blur-2xl" />

      <Sparkle className="absolute left-6 top-6 sm:left-10 sm:top-10" size={20} />
      <Sparkle className="absolute right-8 top-10 sm:right-16" size={20} />
      <Sparkle className="absolute bottom-10 left-8 sm:left-20" size={16} />
      <Sparkle className="absolute bottom-8 right-10 sm:right-24" size={18} />

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="hidden lg:block">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-display text-3xl font-black text-black"
              aria-label="Go to CampusConnect home"
            >
              CAMPUS<span className="neu-border bg-black px-2 py-1 text-amber-300">CONNECT</span>
            </Link>

            <div className="mt-10 neu-border bg-lime p-8 shadow-[10px_10px_0_#111827]">
              <p className="eyebrow font-black text-black">Secure recovery</p>
              <h1 className="mt-4 font-display text-5xl font-black leading-tight text-black">
                Get back to your campus community.
              </h1>
              <p className="mt-5 max-w-md font-mono text-sm leading-7 text-black">
                We&apos;ll send a password reset link to your registered college email. The message
                stays privacy-safe, so account existence is never revealed.
              </p>

              <div className="mt-8 grid gap-4">
                <div className="neu-border flex items-start gap-3 bg-white p-4">
                  <ShieldCheck
                    className="mt-1 h-5 w-5 shrink-0 text-indigo-900"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-display text-lg font-black text-black">Privacy-first flow</p>
                    <p className="font-mono text-xs leading-5 text-gray-700">
                      The same confirmation appears whether or not an email exists.
                    </p>
                  </div>
                </div>

                <div className="neu-border flex items-start gap-3 bg-peach p-4">
                  <MailCheck className="mt-1 h-5 w-5 shrink-0 text-indigo-900" aria-hidden="true" />
                  <div>
                    <p className="font-display text-lg font-black text-black">Inbox ready</p>
                    <p className="font-mono text-xs leading-5 text-gray-700">
                      Check your inbox and spam folder after requesting the reset link.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-lg">
            <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
              <Link
                to="/"
                className="font-display text-2xl font-black text-black"
                aria-label="Go to CampusConnect home"
              >
                CAMPUS<span className="bg-black px-1 text-amber-300">CONNECT</span>
              </Link>
            </div>

            <Link
              to="/auth"
              className="mb-5 inline-flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.2em] text-black underline decoration-2 underline-offset-4 transition hover:text-indigo-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to sign in
            </Link>

            <div className="neu-border bg-white p-6 shadow-[8px_8px_0_#111827] sm:p-8">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border-2 border-black bg-peach px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.2em] text-black">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Password help
              </div>

              <p className="eyebrow mb-2 font-black text-black">Forgot password</p>
              <h1 className="font-display text-3xl font-black leading-tight text-indigo-900 sm:text-4xl">
                Reset your password
              </h1>

              {submitted ? (
                <div className="mt-7 space-y-5">
                  <div className="neu-border bg-lime p-5">
                    <MailCheck className="mb-3 h-7 w-7 text-black" aria-hidden="true" />
                    <p className="font-display text-xl font-black text-black">Check your email</p>
                    <p className="mt-2 font-mono text-sm leading-6 text-black">
                      If an account exists for that email, we&apos;ve sent a link to reset your
                      password. Check your inbox and spam folder.
                    </p>
                  </div>

                  <Button asChild variant="primary" className="w-full">
                    <Link to="/auth">Back to sign in</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mt-4 font-mono text-sm leading-6 text-gray-700">
                    Enter the email associated with your account and we&apos;ll send you a secure
                    reset link.
                  </p>

                  {error && (
                    <div
                      role="alert"
                      className="mt-5 neu-border bg-red-100 p-3 font-mono text-sm font-bold text-red-800"
                    >
                      {error}
                    </div>
                  )}

                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="mt-6 space-y-5"
                      noValidate
                    >
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel required className="eyebrow font-black text-black">
                              College email
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="you@college.edu"
                                autoComplete="email"
                                className="neu-border mt-2 h-12 rounded-none bg-cream px-4 font-mono text-sm text-black placeholder:text-gray-500 focus-visible:ring-4 focus-visible:ring-lime"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="font-mono text-xs font-bold text-red-700" />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        disabled={loading}
                        variant="primary"
                        className="h-12 w-full gap-2 text-sm uppercase tracking-[0.18em]"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                        {loading ? "Sending..." : "Send reset link"}
                      </Button>
                    </form>
                  </Form>

                  <p className="mt-6 text-center font-mono text-xs text-black">
                    Remembered it?{" "}
                    <Link
                      to="/auth"
                      className="font-black text-blue-700 underline decoration-2 underline-offset-4"
                    >
                      Sign in
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
