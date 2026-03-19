"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    addMonths, subMonths, isSameMonth, isSameDay, isToday, addDays, parseISO
} from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AppointmentModal } from "./appointment-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Ban, ChevronLeft, ChevronRight, Video, ExternalLink, Users } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type ConvexAppointment = NonNullable<ReturnType<typeof useQuery<typeof api.appointments.queries.list>>>[number];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDuration(startAt: number, endAt: number) {
    const mins = Math.round((endAt - startAt) / 60_000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_COLORS: Record<string, string> = {
    Upcoming: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Ongoing:  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    Expired:  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    Cancelled:"bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const DOT_COLORS: Record<string, string> = {
    Upcoming: "bg-blue-500",
    Ongoing:  "bg-green-500",
    Expired:  "bg-slate-400",
    Cancelled:"bg-red-400",
};

// ── Calendar ──────────────────────────────────────────────────────────────────

function AppointmentsCalendar({ appointments }: { appointments: ConvexAppointment[] }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let d = calStart;
    while (d <= calEnd) {
        days.push(d);
        d = addDays(d, 1);
    }

    // Map date strings (YYYY-MM-DD) → appointments on that day
    const byDay = useMemo(() => {
        const map = new Map<string, ConvexAppointment[]>();
        for (const appt of appointments) {
            const key = format(new Date(appt.startAt), "yyyy-MM-dd");
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(appt);
        }
        return map;
    }, [appointments]);

    const selectedAppts = selectedDay
        ? (byDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [])
        : [];

    const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="font-semibold text-sm">
                    {format(currentMonth, "MMMM yyyy")}
                </h3>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCurrentMonth(new Date())}>
                        Today
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Week day labels */}
            <div className="grid grid-cols-7 border-b">
                {weekDays.map((wd) => (
                    <div key={wd} className="text-center text-xs font-medium text-muted-foreground py-2">
                        {wd}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
                {days.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayAppts = byDay.get(key) ?? [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const isDayToday = isToday(day);

                    return (
                        <Popover key={key} open={(isSelected ?? false) && dayAppts.length > 0} onOpenChange={(open) => { if (!open) setSelectedDay(null); }}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDay(dayAppts.length > 0 ? (isSelected ? null : day) : null)}
                                    className={cn(
                                        "relative min-h-[72px] p-1.5 text-left border-b border-r transition-colors",
                                        isCurrentMonth ? "bg-background hover:bg-muted/50" : "bg-muted/20 text-muted-foreground/50",
                                        isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                                        dayAppts.length > 0 && "cursor-pointer",
                                        dayAppts.length === 0 && "cursor-default"
                                    )}
                                >
                                    <span className={cn(
                                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                                        isDayToday && "bg-primary text-primary-foreground",
                                        !isDayToday && isCurrentMonth && "text-foreground",
                                    )}>
                                        {format(day, "d")}
                                    </span>

                                    {/* Appointment dots — max 3 shown, then "+N" */}
                                    {dayAppts.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-0.5">
                                            {dayAppts.slice(0, 3).map((a) => (
                                                <span
                                                    key={a._id}
                                                    className={cn(
                                                        "inline-block h-1.5 w-1.5 rounded-full",
                                                        DOT_COLORS[a.status] ?? "bg-blue-400"
                                                    )}
                                                />
                                            ))}
                                            {dayAppts.length > 3 && (
                                                <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                                                    +{dayAppts.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            </PopoverTrigger>

                            {/* Day popover — lists appointments */}
                            {dayAppts.length > 0 && (
                                <PopoverContent className="w-72 p-2 space-y-1.5">
                                    <p className="text-xs font-semibold text-muted-foreground px-1 pb-1">
                                        {format(day, "EEEE, MMMM d")}
                                    </p>
                                    {dayAppts.map((a) => (
                                        <div key={a._id} className="rounded-lg border p-2.5 text-sm space-y-1 hover:bg-muted/50 transition-colors">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-medium text-sm leading-snug">{a.title}</p>
                                                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", STATUS_COLORS[a.status])}>
                                                    {a.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {fmtTime(a.startAt)} · {fmtDuration(a.startAt, a.endAt)}
                                            </p>
                                            {a.googleMeetLink && (
                                                <a
                                                    href={a.googleMeetLink}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                                >
                                                    <Video className="h-3 w-3" /> Join Meet
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </PopoverContent>
                            )}
                        </Popover>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 px-4 py-2.5 border-t bg-muted/30 text-xs text-muted-foreground">
                {Object.entries(DOT_COLORS).map(([status, color]) => (
                    <span key={status} className="flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", color)} />
                        {status}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ── Table skeleton ────────────────────────────────────────────────────────────

function TableSkeleton() {
    return (
        <div className="rounded-xl border overflow-hidden">
            <div className="border-b bg-muted/40 p-3 flex gap-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-32" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-8 w-16" />
                </div>
            ))}
        </div>
    );
}

function CalendarSkeleton() {
    return (
        <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-7 w-24" />
            </div>
            <div className="grid grid-cols-7 gap-px bg-border p-px">
                {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-[72px]" />
                ))}
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
    const { user, isAdmin, isCaseManager } = useRole();
    const canCreate = isAdmin || isCaseManager;

    const rawAppointments = useQuery(api.appointments.queries.list, { includeExpired: false });
    const allAppointments = useQuery(api.appointments.queries.list, { includeExpired: true });
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const cases = useQuery(api.cases.queries.list) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];
    const cancelAppointment = useMutation(api.appointments.mutations.cancel);
    const removeAppointment = useMutation(api.appointments.mutations.remove);

    const isLoading = rawAppointments === undefined;

    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterType, setFilterType] = useState("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ConvexAppointment | null>(null);
    const [cancelDialog, setCancelDialog] = useState<{ open: boolean; id: Id<"appointments"> | null }>({ open: false, id: null });

    // Build lookup maps
    const clientMap = useMemo(
        () => new Map(clients.map((c) => [c._id, `${c.firstName} ${c.lastName}`])),
        [clients]
    );
    const caseMap = useMemo(
        () => new Map(cases.map((c) => [c._id, `${c.caseNumber}`])),
        [cases]
    );
    const userMap = useMemo(
        () => new Map(users.map((u) => [u._id, u.fullName])),
        [users]
    );

    const appointments = rawAppointments ?? [];

    // Build type options from every type present in loaded appointments
    const typeOptions = useMemo(() => {
        const seen = new Set<string>();
        for (const a of allAppointments ?? []) {
            if (a.type) seen.add(a.type);
        }
        return Array.from(seen).sort();
    }, [allAppointments]);

    // Filter
    const filtered = useMemo(() => {
        return appointments.filter((a) => {
            const clientName = a.clientId ? (clientMap.get(a.clientId) ?? "") : "";
            const q = search.toLowerCase();
            if (q && !a.title.toLowerCase().includes(q) && !clientName.toLowerCase().includes(q)) return false;
            if (filterStatus !== "all" && a.status !== filterStatus) return false;
            if (filterType !== "all" && a.type !== filterType) return false;
            return true;
        });
    }, [appointments, search, filterStatus, filterType, clientMap]);

    const handleCancel = async () => {
        if (!cancelDialog.id) return;
        try {
            await cancelAppointment({ id: cancelDialog.id });
            setCancelDialog({ open: false, id: null });
            toast.success("Appointment cancelled.");
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const canEditAppointment = (a: ConvexAppointment) =>
        isAdmin || a.createdBy === user?._id;

    return (
        <div className="space-y-6">
            <PageHeader
                title={isAdmin ? "All Appointments" : "My Appointments"}
                description="Schedule and manage Google Meet appointments"
                actionLabel={canCreate ? "New Appointment" : undefined}
                onAction={canCreate ? () => { setEditing(null); setModalOpen(true); } : undefined}
            />

            {/* ── Upcoming Appointments Table ── */}
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                    <Input
                        placeholder="Search appointments..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-56 h-8 text-sm"
                    />
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="Upcoming">Upcoming</SelectItem>
                            <SelectItem value="Ongoing">Ongoing</SelectItem>
                            <SelectItem value="Expired">Expired</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {typeOptions.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {isLoading ? (
                    <TableSkeleton />
                ) : filtered.length === 0 ? (
                    <div className="rounded-xl border bg-muted/20 py-16 text-center text-sm text-muted-foreground">
                        No appointments found.{" "}
                        {canCreate && (
                            <button className="underline hover:text-foreground" onClick={() => { setEditing(null); setModalOpen(true); }}>
                                Schedule one now.
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="rounded-xl border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40">
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date & Time</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Duration</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Attendees</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Meet</th>
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((a) => {
                                        const clientName = a.clientId ? (clientMap.get(a.clientId) ?? "—") : "—";
                                        const caseNum = a.caseId ? (caseMap.get(a.caseId) ?? "") : "";
                                        const attendeeCount = (a.attendees ?? []).length;

                                        return (
                                            <tr key={a._id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <p className="font-medium">{a.title}</p>
                                                        {a.meetingType === "case_appointment" && clientName !== "—" && (
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {clientName}{caseNum ? ` · ${caseNum}` : ""}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">{a.type}</td>
                                                <td className="px-4 py-3">
                                                    <p>{fmtDate(a.startAt)}</p>
                                                    <p className="text-xs text-muted-foreground">{fmtTime(a.startAt)}</p>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">{fmtDuration(a.startAt, a.endAt)}</td>
                                                <td className="px-4 py-3">
                                                    {attendeeCount > 0 ? (
                                                        <span className="flex items-center gap-1 text-muted-foreground">
                                                            <Users className="h-3.5 w-3.5" />
                                                            {attendeeCount}
                                                        </span>
                                                    ) : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {a.googleMeetLink ? (
                                                        <a
                                                            href={a.googleMeetLink}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                                        >
                                                            <Video className="h-3.5 w-3.5" />
                                                            Join
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[a.status])}>
                                                        {a.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        {canEditAppointment(a) && a.status !== "Cancelled" && a.status !== "Expired" && (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() => { setEditing(a); setModalOpen(true); }}
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                                    onClick={() => setCancelDialog({ open: true, id: a._id })}
                                                                >
                                                                    <Ban className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Calendar View ── */}
            {isLoading ? (
                <CalendarSkeleton />
            ) : (
                <AppointmentsCalendar appointments={allAppointments ?? []} />
            )}

            {/* ── Modals ── */}
            <AppointmentModal
                open={modalOpen}
                onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }}
                appointment={editing}
            />
            <ConfirmDialog
                open={cancelDialog.open}
                onOpenChange={(open) => setCancelDialog({ open, id: cancelDialog.id })}
                title="Cancel Appointment"
                description="Are you sure you want to cancel this appointment? All attendees will be notified and the Google Calendar event will be cancelled."
                onConfirm={handleCancel}
                confirmText="Cancel Appointment"
                variant="destructive"
            />
        </div>
    );
}
