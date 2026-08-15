// src/routes/claim-swap.tsx
//
// The claim link route. Users arrive here via the SMS link:
//   /claim-swap?token=abc123&offer=uuid
//
// If logged in, automatically attempts to claim the ticket.
// If not logged in, prompts the user to log in first, then claims.

import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Ticket } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { claimSwapOffer } from "@/lib/waitlistSwap";

export default function ClaimSwapRoute() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const offerId = searchParams.get("offer");

    const [status, setStatus] = useState<"loading" | "success" | "error" | "unauthenticated">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token || !offerId) {
            setStatus("error");
            setMessage("Invalid claim link. Please check the URL.");
            return;
        }

        (async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setStatus("unauthenticated");
                setMessage("Please log in to claim your ticket.");
                return;
            }

            const result = await claimSwapOffer(offerId, token, session.user.id);

            if (result.success) {
                setStatus("success");
                setMessage(result.message);
            } else {
                setStatus("error");
                setMessage(result.message);
            }
        })();
    }, [token, offerId]);

    return (
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-8 text-center">
            {status === "loading" && (
                <>
                    <Loader2 className="mb-4 h-12 w-12 animate-spin text-indigo-500" />
                    <h1 className="text-xl font-bold">Claiming your ticket…</h1>
                    <p className="mt-2 text-slate-500">Verifying your claim link.</p>
                </>
            )}

            {status === "success" && (
                <>
                    <CheckCircle2 className="mb-4 h-16 w-16 text-emerald-500" />
                    <h1 className="text-2xl font-bold">You're in! 🎉</h1>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">{message}</p>
                    <Link
                        to="/dashboard"
                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                        <Ticket className="h-4 w-4" />
                        Go to Dashboard
                    </Link>
                </>
            )}

            {status === "error" && (
                <>
                    <XCircle className="mb-4 h-16 w-16 text-red-500" />
                    <h1 className="text-2xl font-bold">Claim Failed</h1>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">{message}</p>
                    <p className="mt-4 text-sm text-slate-400">
                        The 15-minute window may have expired, or the link is invalid.
                    </p>
                </>
            )}

            {status === "unauthenticated" && (
                <>
                    <Ticket className="mb-4 h-12 w-12 text-indigo-500" />
                    <h1 className="text-2xl font-bold">Log in to claim</h1>
                    <p className="mt-2 text-slate-600 dark:text-slate-400">{message}</p>
                    <Link
                        to={`/auth/login?redirect=/claim-swap?token=${token}&offer=${offerId}`}
                        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                        Log in
                    </Link>
                </>
            )}
        </div>
    );
}
