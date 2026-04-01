"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    CalendarDays, Clock, Mail, Phone, MessageSquare,
    CheckCircle2, XCircle, Video, MapPin, CreditCard, Send,
} from "lucide-react";

export type ProspectRequest = {
    _id: Id<"appointmentRequests">;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    appointmentType: string;
    preferredDate: string;
    preferredTime: string;
    clientTimezone?: string;
    meetingMode?: "online" | "in_person";
    message?: string;
    status:
        | "pending"
        | "confirmed"
        | "awaiting_payment"
        | "paid"
        | "rejected"
        | "payment_expired"
        | "accepted_as_client"
        | "declined_after_meeting";
    createdAt: number;
    convertedAppointmentId?: Id<"appointments">;
    convertedClientId?: Id<"clients">;
    paymentAmountCents?: number;
    paymentCurrency?: string;
    paymentDeadline?: number;
    lastPaymentEmailSentAt?: number;
};

type Props = {
    request: ProspectRequest | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-md bg-muted flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-sm text-foreground">{value}</p>
            </div>
        </div>
    );
}

// Format "HH:MM" → "9:00 AM"
function formatTime(t: string) {
    const [h, m] = t.split(":").map(Number);
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const STATUS_CONFIG: Record<ProspectRequest["status"], { label: string; className: string }> = {
    pending:               { label: "Pending",            className: "text-amber-600 border-amber-400" },
    confirmed:             { label: "Confirmed",          className: "text-blue-600 border-blue-400" },
    awaiting_payment:      { label: "Awaiting Payment",   className: "text-orange-600 border-orange-400" },
    paid:                  { label: "Paid",               className: "text-green-600 border-green-400" },
    rejected:              { label: "Rejected",           className: "text-red-600 border-red-400" },
    payment_expired:       { label: "Payment Expired",    className: "text-red-600 border-red-400" },
    accepted_as_client:    { label: "Accepted as Client", className: "text-green-600 border-green-400" },
    declined_after_meeting:{ label: "Declined",           className: "text-slate-500 border-slate-400" },
};

const RESEND_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes — must match server-side value

function formatCountdown(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export function ProspectReviewModal({ request, open, onOpenChange }: Props) {
    const confirmRequest    = useMutation(api.appointmentRequests.mutations.confirm);
    const rejectRequest     = useMutation(api.appointmentRequests.mutations.reject);
    const resendPaymentEmail = useMutation(api.appointmentRequests.mutations.resendPaymentEmail);

    const [mode, setMode] = useState<"view" | "reject">("view");
    const [rejectReason, setRejectReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [resending, setResending] = useState(false);

    // Cooldown countdown — initialised from the server-stamped lastPaymentEmailSentAt
    // so the state survives page refresh and reflects resends by other admins.
    const [remainingMs, setRemainingMs] = useState<number>(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Recompute remaining cooldown whenever the modal opens or the request changes
    useEffect(() => {
        if (!open || !request?.lastPaymentEmailSentAt) {
            setRemainingMs(0);
            return;
        }
        const elapsed = Date.now() - request.lastPaymentEmailSentAt;
        const remaining = RESEND_COOLDOWN_MS - elapsed;
        setRemainingMs(remaining > 0 ? remaining : 0);
    }, [open, request?.lastPaymentEmailSentAt]);

    // Tick down every second while cooldown is active
    useEffect(() => {
        if (remainingMs <= 0) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }
        intervalRef.current = setInterval(() => {
            setRemainingMs((prev) => {
                const next = prev - 1000;
                if (next <= 0) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    return 0;
                }
                return next;
            });
        }, 1000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [remainingMs > 0]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleResendPaymentEmail = async () => {
        if (!request) return;
        setResending(true);
        try {
            await resendPaymentEmail({ requestId: request._id });
            toast.success("Payment link resent to prospect.");
            setRemainingMs(RESEND_COOLDOWN_MS);
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setResending(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setMode("view");
        setRejectReason("");
    };

    const handleConfirm = async () => {
        if (!request) return;
        setSaving(true);
        try {
            await confirmRequest({ requestId: request._id });
            toast.success("Appointment confirmed — prospect will receive a confirmation email.");
            handleClose();
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        if (!request) return;
        setSaving(true);
        try {
            await rejectRequest({ requestId: request._id, reason: rejectReason.trim() || undefined });
            toast.success("Request rejected.");
            handleClose();
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (!request) return null;

    const submittedAt = new Date(request.createdAt).toLocaleDateString(undefined, {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const statusCfg = STATUS_CONFIG[request.status] ?? { label: request.status, className: "text-muted-foreground border-border" };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent style={{ maxWidth: "680px" }}>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">
                                {request.firstName[0]}{request.lastName[0]}
                            </span>
                        </div>
                        <div>
                            <DialogTitle>{request.firstName} {request.lastName}</DialogTitle>
                            <div className="flex items-center gap-2 mt-0.5">
                                <DialogDescription>Submitted {submittedAt}</DialogDescription>
                                <Badge variant="outline" className={statusCfg.className}>
                                    {statusCfg.label}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* ── Request details ── */}
                {mode === "view" && (
                    <div className="space-y-3 py-1">
                        <InfoRow icon={Mail} label="Email" value={request.email} />
                        {request.phone && <InfoRow icon={Phone} label="Phone" value={request.phone} />}
                        <InfoRow icon={CalendarDays} label="Appointment type" value={request.appointmentType} />
                        <InfoRow icon={CalendarDays} label="Preferred date" value={request.preferredDate} />
                        <InfoRow
                            icon={Clock}
                            label="Preferred time"
                            value={`${formatTime(request.preferredTime)}${request.clientTimezone ? ` (${request.clientTimezone})` : ""}`}
                        />
                        <InfoRow
                            icon={request.meetingMode === "online" ? Video : MapPin}
                            label="Meeting type"
                            value={request.meetingMode === "online" ? "Online (video meeting)" : "In-person"}
                        />
                        {request.message && (
                            <InfoRow icon={MessageSquare} label="Message" value={request.message} />
                        )}

                        {/* Payment info for awaiting_payment / paid */}
                        {(request.status === "awaiting_payment" || request.status === "paid") &&
                            request.paymentAmountCents !== undefined && (
                            <div className="rounded-lg border border-amber-100 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-950/20 p-3 flex items-start gap-3">
                                <CreditCard className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Consultation fee</p>
                                    <p className="text-sm text-amber-800 dark:text-amber-300">
                                        {(request.paymentAmountCents / 100).toLocaleString(undefined, {
                                            style: "currency",
                                            currency: request.paymentCurrency ?? "USD",
                                        })}{" "}
                                        — {request.status === "paid" ? "Payment received" : "Awaiting payment"}
                                    </p>
                                    {request.paymentDeadline && request.status === "awaiting_payment" && (
                                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                                            Deadline: {new Date(request.paymentDeadline).toLocaleDateString(undefined, {
                                                month: "short", day: "numeric", year: "numeric",
                                            })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                )}

                {/* ── Reject mode ── */}
                {mode === "reject" && (
                    <div className="space-y-3 py-1">
                        <p className="text-sm text-muted-foreground">
                            Rejecting this request from <strong className="text-foreground">{request.firstName} {request.lastName}</strong>.
                            You can optionally add a reason (visible only to your team).
                        </p>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g. No availability on requested date"
                                rows={3}
                                className="resize-none"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {/* ── Footer: pending requests ── */}
                {request.status === "pending" && (
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <div className="flex-1 flex flex-col sm:flex-row gap-2">
                            {mode === "view" && (
                                <>
                                    <Button
                                        variant="outline"
                                        className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                                        onClick={() => setMode("reject")}
                                        disabled={saving}
                                    >
                                        <XCircle className="h-4 w-4 mr-1.5" /> Reject
                                    </Button>
                                    <Button onClick={handleConfirm} disabled={saving} className="flex-1">
                                        {saving
                                            ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />Confirming…</span>
                                            : <><CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm Appointment</>
                                        }
                                    </Button>
                                </>
                            )}
                            {mode === "reject" && (
                                <>
                                    <Button variant="outline" onClick={() => setMode("view")} disabled={saving}>
                                        Cancel
                                    </Button>
                                    <Button variant="destructive" onClick={handleReject} disabled={saving}>
                                        {saving ? "Rejecting…" : "Confirm Rejection"}
                                    </Button>
                                </>
                            )}
                        </div>
                    </DialogFooter>
                )}

                {/* ── Footer: awaiting_payment — resend button + close ── */}
                {request.status === "awaiting_payment" && (
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={handleClose} className="sm:mr-auto">
                            Close
                        </Button>
                        <Button
                            onClick={handleResendPaymentEmail}
                            disabled={resending || remainingMs > 0}
                            variant="outline"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 disabled:opacity-60 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40 min-w-[200px]"
                        >
                            {resending ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-3.5 w-3.5 border-2 border-amber-400/40 border-t-amber-600 rounded-full animate-spin" />
                                    Sending…
                                </span>
                            ) : remainingMs > 0 ? (
                                <span className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5" />
                                    Resend in {formatCountdown(remainingMs)}
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Send className="h-3.5 w-3.5" />
                                    Resend Payment Email
                                </span>
                            )}
                        </Button>
                    </DialogFooter>
                )}

                {/* ── Footer: all other (non-pending, non-awaiting_payment) statuses ── */}
                {request.status !== "pending" && request.status !== "awaiting_payment" && (
                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose}>Close</Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
