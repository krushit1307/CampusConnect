import { Link } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

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
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-4 py-16">
      <Sparkle className="absolute left-8 top-8" size={20} />
      <Sparkle className="absolute right-8 top-8" size={20} />
      <Sparkle className="absolute bottom-8 left-8" size={16} />
      <Sparkle className="absolute bottom-8 right-8" size={16} />
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-block font-display text-2xl font-bold text-black">
          CAMPUS<span className="bg-black px-1 text-amber-300">CONNECT</span>
        </Link>
        <div className="neu-border bg-white p-8">
          <p className="eyebrow mb-2 font-bold text-black">Forgot password</p>
          <h1 className="mb-6 text-3xl font-bold text-indigo-900">Reset your password</h1>

          {submitted ? (
            <div className="space-y-4">
              <div className="bg-lime/40 p-3 font-mono text-sm">
                If an account exists for that email, we&apos;ve sent a link to reset your password.
                Check your inbox (and spam folder).
              </div>
              <Link
                to="/auth"
                className="inline-block font-mono text-xs font-bold underline underline-offset-2"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-6 font-mono text-sm text-gray-600">
                Enter the email associated with your account and we&apos;ll send you a link to reset
                your password.
              </p>
              {error && (
                <div role="alert" className="mb-4 bg-red-100 p-2 font-mono text-sm text-red-700">
                  {error}
                </div>
              )}
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4 text-red-900"
                  noValidate
                >
                  <FormField
                    control={form.control}
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
                  <Button type="submit" disabled={loading} variant="primary" className="w-full">
                    {loading ? "Sending..." : "Send reset link"}
                  </Button>
                </form>
              </Form>
              <p className="mt-6 text-center font-mono text-xs text-black">
                Remembered it?{" "}
                <Link to="/auth" className="font-bold underline underline-offset-2 text-blue-700">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
