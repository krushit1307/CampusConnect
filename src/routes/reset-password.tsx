import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkle } from "@/components/site/Sparkle";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrengthMeter, getPasswordStrength } from "@/components/ui/password-strength";
import { toast } from "sonner";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/schemas";
import { getFriendlyAuthError } from "@/utils/authErrors";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const navigate = useNavigate();
  const supabase = createClient();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = form.watch("password");

  // The Supabase client parses the recovery token out of the magic-link URL and
  // exchanges it for a session automatically. We just need to wait for that to
  // happen (or for a PASSWORD_RECOVERY auth event) before showing the form.
  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setLinkValid(true);
        setCheckingLink(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session) {
        setLinkValid(true);
      }
      setCheckingLink(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(values: ResetPasswordFormValues) {
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (updateError) throw updateError;

      toast.success("Password updated. Please sign in with your new password.");
      // Sign out of the recovery session so the new password is required going forward.
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
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
          <p className="eyebrow mb-2 font-bold text-black">Reset password</p>
          <h1 className="mb-6 text-3xl font-bold text-indigo-900">Choose a new password</h1>

          {checkingLink ? (
            <p className="font-mono text-sm text-gray-600">Checking your reset link...</p>
          ) : !linkValid ? (
            <div className="space-y-4">
              <div className="bg-red-100 p-3 font-mono text-sm text-red-700">
                This reset link is invalid or has expired. Please request a new one.
              </div>
              <Link
                to="/forgot-password"
                className="inline-block font-mono text-xs font-bold underline underline-offset-2 text-black"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="mb-4 bg-red-100 p-2 font-mono text-sm text-red-700">
                  {error}
                </div>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required className="font-bold">
                          New password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder="********"
                            autoComplete="new-password"
                            className="px-1 py-2 font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        {password && <PasswordStrengthMeter password={password} />}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required className="font-bold">
                          Confirm new password
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
                  <Button
                    type="submit"
                    disabled={loading || getPasswordStrength(password) === "weak"}
                    variant="primary"
                    className="w-full"
                  >
                    {loading ? "Updating..." : "Update password"}
                  </Button>
                </form>
              </Form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
