// src/components/budget/BudgetApprovalDashboard.tsx
//
// Admin dashboard for the Student Union to review and approve budget requests.

import { useEffect, useState } from "react";
import { Check, X, MessageSquare, Loader2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    fetchPendingBudgetRequests,
    approveBudgetRequest,
    rejectBudgetRequest,
    requestBudgetChanges,
    type BudgetRequest,
} from "@/lib/budgetWorkflow";

interface BudgetApprovalDashboardProps {
    adminId: string;
}

export function BudgetApprovalDashboard({ adminId }: BudgetApprovalDashboardProps) {
    const [requests, setRequests] = useState<BudgetRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [comment, setComment] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setIsLoading(true);
        const data = await fetchPendingBudgetRequests();
        setRequests(data);
        setIsLoading(false);
    };

    const handleApprove = async (requestId: string) => {
        setActionLoading(requestId);
        await approveBudgetRequest(requestId, adminId, comment || undefined);
        setActionLoading(null);
        setExpandedId(null);
        setComment("");
        loadRequests();
    };

    const handleReject = async (requestId: string) => {
        setActionLoading(requestId);
        await rejectBudgetRequest(requestId, adminId, comment || undefined);
        setActionLoading(null);
        setExpandedId(null);
        setComment("");
        loadRequests();
    };

    const handleRequestChanges = async (requestId: string) => {
        setActionLoading(requestId);
        await requestBudgetChanges(requestId, adminId, comment);
        setActionLoading(null);
        setExpandedId(null);
        setComment("");
        loadRequests();
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center">
                <Check className="mb-2 h-12 w-12 text-emerald-500" />
                <p className="text-lg font-medium text-slate-600 dark:text-slate-300">
                    No pending budget requests
                </p>
                <p className="text-sm text-slate-400">All caught up!</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            <header className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Budget Approval Queue</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Review and approve funding requests from clubs.
                </p>
            </header>

            <div className="space-y-4">
                {requests.map((req) => (
                    <div
                        key={req.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-indigo-500" />
                                    <h3 className="font-semibold">
                                        ${req.total_requested.toFixed(2)}
                                    </h3>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                        {req.status.replace("_", " ")}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-400">
                                    Event: {req.event_id} • Submitted{" "}
                                    {new Date(req.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setExpandedId(expandedId === req.id ? null : req.id);
                                    setComment(req.admin_comment ?? "");
                                }}
                            >
                                <MessageSquare className="mr-1 h-4 w-4" />
                                {expandedId === req.id ? "Close" : "Review"}
                            </Button>
                        </div>

                        {expandedId === req.id && (
                            <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                        Admin Comment
                                    </label>
                                    <Textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Leave a comment for the club treasurer..."
                                        rows={3}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        onClick={() => handleApprove(req.id)}
                                        disabled={actionLoading === req.id}
                                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        {actionLoading === req.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Check className="h-4 w-4" />
                                        )}
                                        Approve
                                    </Button>
                                    <Button
                                        onClick={() => handleRequestChanges(req.id)}
                                        disabled={actionLoading === req.id}
                                        variant="outline"
                                        className="gap-1.5"
                                    >
                                        Request Changes
                                    </Button>
                                    <Button
                                        onClick={() => handleReject(req.id)}
                                        disabled={actionLoading === req.id}
                                        variant="outline"
                                        className="gap-1.5 text-red-600 hover:text-red-700"
                                    >
                                        <X className="h-4 w-4" />
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
