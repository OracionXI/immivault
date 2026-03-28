"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertTriangle, X, Plus, Loader2, Link2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import Link from "next/link";

type ConvexAppointment = NonNullable<ReturnType<typeof useQuery<typeof api.appointments.queries.list>>>[number];

interface Attendee {
    type: "internal" | "external" | "client";
    userId?: Id<"users">;
    email: string;
    name: string;
}

interface AppointmentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appointment: ConvexAppointment | null;
}

const DEFAULT_APPOINTMENT_TYPES = ["Consultation", "Document Review", "Interview Prep", "Follow-up"];
const DURATION_MINS = 60; // All appointments are fixed at 60 minutes

function tsToDateStr(ts: number) {
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function tsToTimeStr(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toTimestamp(dateStr: string, timeStr: string) {
    return new Date(`${dateStr}T${timeStr}`).getTime();
}

export function AppointmentModal({ open, onOpenChange, appointment }: AppointmentModalProps) {
    const { user } = useRole();
    const isAccountant = user?.role === "accountant";
    const createAppointment = useMutation(api.appointments.mutations.create);
    const updateAppointment = useMutation(api.appointments.mutations.update);
    const cases = useQuery(api.cases.queries.list) ?? [];
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const users = useQuery(api.users.queries.listByOrg) ?? [];
    const settings = useQuery(api.organisations.queries.getSettings);
    const appointmentTypes = settings?.appointmentTypes ?? DEFAULT_APPOINTMENT_TYPES;

    const isConnected = !!user?.googleEmail;
    const isEditing = !!appointment;

    // ── Form state ────────────────────────────────────────────────────────────
    // Accountants can only create general meetings — lock the type
    const [meetingType, setMeetingType] = useState<"case_appointment" | "general_meeting">(
        isAccountant ? "general_meeting" : "case_appointment"
    );
    const [title, setTitle] = useState("");
    const [type, setType] = useState("Consultation");
    const [caseId, setCaseId] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const durationMins = DURATION_MINS;
    const [notes, setNotes] = useState("");
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [externalEmail, setExternalEmail] = useState("");
    const [externalName, setExternalName] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // ── Blackout dates for internal attendees ─────────────────────────────────
    const internalAttendeeIds = useMemo(() => {
        const ids = attendees.filter((a) => a.type === "internal" && a.userId).map((a) => a.userId as Id<"users">);
        if (user?._id && !ids.includes(user._id)) ids.push(user._id);
        return ids;
    }, [attendees, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps
    const blackoutDates = useQuery(
        api.staffAvailability.queries.getBlackoutDatesForUsers,
        { userIds: internalAttendeeIds }
    ) ?? [];
    const blackoutSet = useMemo(() => new Set(blackoutDates), [blackoutDates]);

    const isDateDisabled = (d: Date) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (d < today) return true;
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return blackoutSet.has(iso);
    };

    // Suggested attendees for the selected case (populated reactively)
    const caseAttendees = useQuery(
        api.cases.queries.getAttendeesForCase,
        meetingType === "case_appointment" && caseId ? { caseId: caseId as Id<"cases"> } : "skip"
    );

    // ── Conflict detection ────────────────────────────────────────────────────
    const startAt = date && time ? toTimestamp(date, time) : 0;
    const endAt = startAt ? startAt + durationMins * 60_000 : 0;
    const conflictArgs = startAt && endAt && user?._id
        ? { userId: user._id, startAt, endAt, excludeId: appointment?._id }
        : "skip";
    const conflicts = useQuery(
        api.appointments.queries.checkConflict,
        conflictArgs === "skip" ? "skip" : conflictArgs
    ) ?? [];

    // ── Auto-populate from case ───────────────────────────────────────────────
    const selectedCase = useMemo(() => cases.find((c) => c._id === caseId), [cases, caseId]);
    const selectedClient = useMemo(
        () => clients.find((c) => c._id === selectedCase?.clientId),
        [clients, selectedCase]
    );

    // Auto-generate default title from selected case
    const autoTitle = useMemo(() => {
        if (meetingType !== "case_appointment" || !selectedCase || !selectedClient) return "";
        return `${selectedCase.caseNumber} – ${selectedClient.firstName} ${selectedClient.lastName}`;
    }, [meetingType, selectedCase, selectedClient]);

    // Auto-fill title when case is selected, but don't overwrite a custom title the user typed
    const prevAutoTitleRef = useRef("");
    useEffect(() => {
        if (isEditing) return;
        if (autoTitle && (title === "" || title === prevAutoTitleRef.current)) {
            setTitle(autoTitle);
        }
        prevAutoTitleRef.current = autoTitle;
    }, [autoTitle]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-populate attendees when a case is selected (new appointments only)
    const populatedForCaseRef = useRef<string | null>(null);
    useEffect(() => {
        if (isEditing || meetingType !== "case_appointment") return;
        if (!caseId) { populatedForCaseRef.current = null; setAttendees([]); return; }
        if (!caseAttendees || caseId === populatedForCaseRef.current) return;
        populatedForCaseRef.current = caseId;

        const suggested: Attendee[] = [];

        // Case manager (internal, exclude self)
        if (caseAttendees.caseManager && caseAttendees.caseManager._id !== user?._id) {
            suggested.push({
                type: "internal",
                userId: caseAttendees.caseManager._id as Id<"users">,
                email: caseAttendees.caseManager.email,
                name: caseAttendees.caseManager.fullName,
            });
        }

        // Task staff (internal, unique, exclude self and already added)
        for (const staff of caseAttendees.taskStaff) {
            if (staff._id === user?._id) continue;
            if (suggested.some((a) => a.userId === staff._id)) continue;
            suggested.push({
                type: "internal",
                userId: staff._id as Id<"users">,
                email: staff.email,
                name: staff.fullName,
            });
        }

        // Client (external)
        if (caseAttendees.client?.email) {
            const clientName = `${caseAttendees.client.firstName} ${caseAttendees.client.lastName}`;
            if (!suggested.some((a) => a.email === caseAttendees.client!.email)) {
                suggested.push({ type: "client", email: caseAttendees.client.email, name: clientName });
            }
        }

        setAttendees(suggested);
    }, [caseId, caseAttendees]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Reset / populate on open ──────────────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        if (appointment) {
            setMeetingType(appointment.meetingType);
            setTitle(appointment.title);
            setType(appointment.type === "General Meeting" ? "Consultation" : appointment.type);
            setCaseId(appointment.caseId ?? "");
            setDate(tsToDateStr(appointment.startAt));
            setTime(tsToTimeStr(appointment.startAt));
            setNotes(appointment.notes ?? "");
            setAttendees((appointment.attendees ?? []) as Attendee[]);
        } else {
            setMeetingType(isAccountant ? "general_meeting" : "case_appointment");
            setTitle("");
            setType("Consultation");
            setCaseId("");
            setDate("");
            setTime("");
            setNotes("");
            setAttendees([]);
        }
        setExternalEmail("");
        setExternalName("");
        setErrors({});
        setDatePickerOpen(false);
    }, [open, appointment]);

    // ── Attendee helpers ──────────────────────────────────────────────────────
    const addInternalAttendee = (userId: string) => {
        if (!userId) return;
        if (attendees.some((a) => a.userId === userId)) return;
        const staff = users.find((u) => u._id === userId);
        if (!staff) return;
        setAttendees((prev) => [...prev, { type: "internal", userId: userId as Id<"users">, email: staff.email, name: staff.fullName }]);
    };

    const addExternalAttendee = () => {
        const email = externalEmail.trim();
        const name = externalName.trim();
        if (!email || !name) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setErrors((e) => ({ ...e, externalEmail: "Invalid email address" }));
            return;
        }
        if (attendees.some((a) => a.email === email)) return;
        setAttendees((prev) => [...prev, { type: "external", email, name }]);
        setExternalEmail("");
        setExternalName("");
        setErrors((e) => { const next = { ...e }; delete next.externalEmail; return next; });
    };

    const removeAttendee = (email: string) => {
        setAttendees((prev) => prev.filter((a) => a.email !== email));
    };

    // ── Validation ────────────────────────────────────────────────────────────
    const validate = () => {
        const errs: Record<string, string> = {};
        if (!title.trim()) errs.title = "Title is required";
        if (meetingType === "case_appointment" && !caseId) errs.caseId = "Case is required";
        if (!date) errs.date = "Date is required";
        if (!time) errs.time = "Time is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const effectiveType = meetingType === "general_meeting" ? "General Meeting" : type;
            const payload = {
                title: title.trim(),
                meetingType,
                type: effectiveType,
                caseId: caseId ? (caseId as Id<"cases">) : undefined,
                clientId: selectedClient?._id,
                startAt,
                endAt,
                attendees,
                notes: notes || undefined,
            };

            if (isEditing) {
                await updateAppointment({ id: appointment._id, ...payload });
                toast.success("Appointment updated.");
            } else {
                await createAppointment(payload);
                toast.success("Appointment created. Google Calendar invite will be sent shortly.");
            }
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const availableStaff = users.filter(
        (u) => u.status === "active" && !attendees.some((a) => a.userId === u._id)
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent style={{ maxWidth: "600px", width: "95vw", maxHeight: "90vh", overflowY: "auto" }}>
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Appointment" : "New Appointment"}</DialogTitle>
                </DialogHeader>

                {/* Google Calendar gate */}
                {!isConnected && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-3 text-sm">
                        <Link2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-amber-800 dark:text-amber-300">Google Calendar not connected</p>
                            <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                                Connect your Google account in{" "}
                                <Link href="/settings" className="underline font-medium" onClick={() => onOpenChange(false)}>
                                    Settings
                                </Link>{" "}
                                to create appointments with Google Meet links.
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid gap-4 py-2">
                    {/* Meeting type toggle — hidden for accountants (general meeting only) */}
                    {!isAccountant && (
                    <div className="grid gap-2">
                        <Label>Meeting Type</Label>
                        <div className="flex rounded-lg border overflow-hidden">
                            {(["case_appointment", "general_meeting"] as const).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setMeetingType(t)}
                                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                                        meetingType === t
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted"
                                    }`}
                                >
                                    {t === "case_appointment" ? "Case Appointment" : "General Meeting"}
                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Case selector (case appointments only) */}
                    {meetingType === "case_appointment" && (
                        <div className="grid gap-2">
                            <Label>Case *</Label>
                            <Select value={caseId} onValueChange={setCaseId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a case" />
                                </SelectTrigger>
                                <SelectContent>
                                    {cases.map((c) => (
                                        <SelectItem key={c._id} value={c._id}>
                                            {c.caseNumber} – {c.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.caseId && <p className="text-xs text-destructive">{errors.caseId}</p>}
                        </div>
                    )}

                    {/* Title */}
                    <div className="grid gap-2">
                        <Label>Title *</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={
                                meetingType === "case_appointment"
                                    ? "Select a case to auto-fill, or type a title"
                                    : "e.g., Team sync, Strategy discussion"
                            }
                        />
                        {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
                    </div>

                    {/* Type (case appointments only) */}
                    {meetingType === "case_appointment" && (
                        <div className="grid gap-2">
                            <Label>Appointment Type</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {appointmentTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Date / Time / Duration */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="grid gap-2">
                            <Label>Date *</Label>
                            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "h-10 w-full justify-start text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                        {date ? date : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date ? new Date(date + "T12:00:00") : undefined}
                                        onSelect={(d) => {
                                            if (!d) return;
                                            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                            setDate(iso);
                                            setDatePickerOpen(false);
                                        }}
                                        disabled={isDateDisabled}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Time *</Label>
                            <Input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                            />
                            {errors.time && <p className="text-xs text-destructive">{errors.time}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Duration</Label>
                            <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                                1 hour
                            </div>
                        </div>
                    </div>

                    {/* Conflict warning */}
                    {conflicts.length > 0 && (
                        <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-900/10 p-3 text-sm text-orange-800 dark:text-orange-300">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">Scheduling conflict</p>
                                <p className="text-orange-700 dark:text-orange-400 mt-0.5">
                                    You already have {conflicts.length} appointment{conflicts.length > 1 ? "s" : ""} at this time.
                                    You can still proceed.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Attendees */}
                    <div className="grid gap-2">
                        <Label>Attendees</Label>

                        {/* Current attendees chips */}
                        {attendees.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-1">
                                {attendees.map((a) => (
                                    <Badge key={a.email} variant="secondary" className="gap-1.5 pl-2.5 pr-1.5 py-1">
                                        <span className="text-xs">{a.name}</span>
                                        <span className="text-xs text-muted-foreground">({a.type === "internal" ? "staff" : a.type === "client" ? "client" : "external"})</span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttendee(a.email)}
                                            className="ml-0.5 hover:text-destructive transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Add internal attendee */}
                        <div className="grid gap-1">
                            <p className="text-xs text-muted-foreground font-medium">Add staff member</p>
                            <Select onValueChange={addInternalAttendee} value="">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select staff to add..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableStaff.map((u) => (
                                        <SelectItem key={u._id} value={u._id}>
                                            {u.fullName} ({u.role === "admin" ? "Admin" : u.role === "case_manager" ? "Case Manager" : u.role === "accountant" ? "Accountant" : "Staff"})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Add external attendee */}
                        <div className="grid gap-1">
                            <p className="text-xs text-muted-foreground font-medium">Add external person</p>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Name"
                                    value={externalName}
                                    onChange={(e) => setExternalName(e.target.value)}
                                    className="flex-1"
                                />
                                <Input
                                    placeholder="Email"
                                    type="email"
                                    value={externalEmail}
                                    onChange={(e) => setExternalEmail(e.target.value)}
                                    className="flex-1"
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExternalAttendee(); } }}
                                />
                                <Button type="button" variant="outline" size="icon" onClick={addExternalAttendee}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            {errors.externalEmail && <p className="text-xs text-destructive">{errors.externalEmail}</p>}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Agenda, preparation notes..."
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || !isConnected}>
                        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {isEditing ? "Save Changes" : "Create & Send Invites"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
