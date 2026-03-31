"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarClock, Globe, CalendarX, Trash2, Info, Ban, Plus, X } from "lucide-react";
import { HintPopover } from "@/components/shared/hint-popover";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { RoleGuard } from "@/components/shared/role-guard";
import { PageHeader } from "@/components/shared/page-header";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getUtcOffset(tz: string): string {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            timeZoneName: "shortOffset",
        }).formatToParts(new Date());
        return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
        return "";
    }
}

const TIMEZONES = [
    "UTC",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "America/Anchorage", "America/Honolulu", "America/Toronto", "America/Vancouver",
    "America/Mexico_City", "America/Sao_Paulo", "America/Argentina/Buenos_Aires",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome",
    "Europe/Amsterdam", "Europe/Stockholm", "Europe/Warsaw", "Europe/Istanbul",
    "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg",
    "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok",
    "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul",
    "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland",
];

type AvailWindow = { dayOfWeek: number; startHour: number; endHour: number; isActive: boolean };

export default function MyAvailabilityPage() {
    const user = useQuery(api.users.queries.tryGetCurrentUser);
    const existingWindows = useQuery(api.staffAvailability.queries.getMyAvailability);
    const blackoutDates = useQuery(api.staffAvailability.queries.getMyBlackoutDates);

    const setTimezone = useMutation(api.users.mutations.setMyTimezone);
    const upsertAvailability = useMutation(api.staffAvailability.mutations.upsertMyAvailability);
    const addBlackout = useMutation(api.staffAvailability.mutations.addBlackoutDate);
    const removeBlackout = useMutation(api.staffAvailability.mutations.removeBlackoutDate);
    const upsertExclusions = useMutation(api.staffAvailabilityExclusions.mutations.upsertExclusions);

    // ── Time Exclusions ───────────────────────────────────────────────────────
    const myExclusions = useQuery(api.staffAvailabilityExclusions.queries.getMyExclusions);

    type ExclusionWindow = { startHour: number; endHour: number };
    // Local state: map from dayOfWeek → windows (mirrors DB, updated on save)
    const [exclusionsByDay, setExclusionsByDay] = useState<Record<number, ExclusionWindow[]>>({});
    const [savingExclusionDay, setSavingExclusionDay] = useState<number | null>(null);
    // Single add form (day + time range)
    const [addExclDay, setAddExclDay] = useState<number>(1);
    const [addExclStart, setAddExclStart] = useState<number>(9);
    const [addExclEnd, setAddExclEnd] = useState<number>(10);

    useEffect(() => {
        if (!myExclusions) return;
        const map: Record<number, ExclusionWindow[]> = {};
        for (const ex of myExclusions) {
            if (!map[ex.dayOfWeek]) map[ex.dayOfWeek] = [];
            map[ex.dayOfWeek].push({ startHour: ex.startHour, endHour: ex.endHour });
        }
        setExclusionsByDay(map);
    }, [myExclusions]);

    const handleSaveExclusions = async (dayOfWeek: number, newWindows: ExclusionWindow[]) => {
        setSavingExclusionDay(dayOfWeek);
        try {
            await upsertExclusions({ dayOfWeek, windows: newWindows });
            setExclusionsByDay((prev) => ({ ...prev, [dayOfWeek]: newWindows }));
            toast.success("Exclusions saved.");
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSavingExclusionDay(null);
        }
    };

    const handleAddExclusion = async () => {
        if (addExclEnd <= addExclStart) {
            toast.error("End time must be after start time.");
            return;
        }
        const current = exclusionsByDay[addExclDay] ?? [];
        const exists = current.some((w) => w.startHour === addExclStart && w.endHour === addExclEnd);
        if (exists) { toast.error("This window already exists."); return; }
        const updated = [...current, { startHour: addExclStart, endHour: addExclEnd }]
            .sort((a, b) => a.startHour - b.startHour);
        await handleSaveExclusions(addExclDay, updated);
    };

    const handleRemoveExclusion = async (dayOfWeek: number, idx: number) => {
        const current = exclusionsByDay[dayOfWeek] ?? [];
        const updated = current.filter((_, i) => i !== idx);
        await handleSaveExclusions(dayOfWeek, updated);
    };

    // ── Timezone ──────────────────────────────────────────────────────────────
    const detectedTz = typeof window !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";

    const [timezone, setTimezoneState] = useState<string>(detectedTz);
    const [savingTz, setSavingTz] = useState(false);

    useEffect(() => {
        if (user?.timezone) setTimezoneState(user.timezone);
    }, [user?.timezone]);

    const handleSaveTimezone = async () => {
        setSavingTz(true);
        try {
            await setTimezone({ timezone });
            toast.success("Timezone saved.");
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSavingTz(false);
        }
    };

    // ── Weekly Schedule ───────────────────────────────────────────────────────
    const [windows, setWindows] = useState<AvailWindow[]>(() =>
        [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startHour: 9, endHour: 17, isActive: true }))
    );
    const [savingWindows, setSavingWindows] = useState(false);

    useEffect(() => {
        if (existingWindows && existingWindows.length > 0) {
            setWindows(existingWindows.map((w) => ({
                dayOfWeek: w.dayOfWeek,
                startHour: w.startHour,
                endHour: w.endHour,
                isActive: w.isActive,
            })));
        }
    }, [existingWindows]);

    const toggleDay = (day: number) => {
        const idx = windows.findIndex((w) => w.dayOfWeek === day);
        if (idx >= 0) {
            setWindows((prev) => prev.filter((_, i) => i !== idx));
        } else {
            setWindows((prev) =>
                [...prev, { dayOfWeek: day, startHour: 9, endHour: 17, isActive: true }]
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            );
        }
    };

    const updateWindow = (day: number, field: "startHour" | "endHour", value: number) => {
        setWindows((prev) => prev.map((w) => w.dayOfWeek === day ? { ...w, [field]: value } : w));
    };

    const handleSaveWindows = async () => {
        setSavingWindows(true);
        try {
            await upsertAvailability({ windows });
            toast.success("Availability saved.");
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSavingWindows(false);
        }
    };

    const hours = Array.from({ length: 25 }, (_, i) => i);

    // ── Blackout Dates ────────────────────────────────────────────────────────
    const [blackoutDate, setBlackoutDate] = useState("");
    const [blackoutReason, setBlackoutReason] = useState("");
    const [addingBlackout, setAddingBlackout] = useState(false);

    const handleAddBlackout = async () => {
        if (!blackoutDate) return;
        setAddingBlackout(true);
        try {
            await addBlackout({ date: blackoutDate, reason: blackoutReason || undefined });
            toast.success("Blackout date added.");
            setBlackoutDate("");
            setBlackoutReason("");
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setAddingBlackout(false);
        }
    };

    const handleRemoveBlackout = async (id: Id<"staffBlackoutDates">) => {
        try {
            await removeBlackout({ id });
            toast.success("Blackout date removed.");
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const todayStr = new Date().toISOString().split("T")[0];

    return (
        <RoleGuard allowedRoles={["admin", "case_manager"]} redirectTo="/settings">
            <div className="space-y-6">
                <PageHeader
                    title="My Availability"
                    description="Set your weekly schedule and block off dates. Clients can only book slots within your available hours."
                />

                {/* ── Timezone ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Globe className="h-4 w-4" />
                            My Timezone
                            <HintPopover
                                title="Why timezone matters"
                                description="Your availability hours are stored and interpreted in this timezone. Clients see the same slots converted to their own local time automatically."
                                tips={[
                                    { text: "Set this to where you physically work — not your client's location." },
                                    { text: "If you travel, update this before clients start booking." },
                                    { text: "Changes take effect for future bookings only." },
                                ]}
                                accent="blue"
                                side="right"
                            />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Your availability hours below are interpreted in this timezone.
                            Clients see slots converted to their local time.
                        </p>
                        {!user?.timezone && (
                            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 p-3 text-sm">
                                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-amber-800 dark:text-amber-300">
                                    We detected your timezone as <strong>{detectedTz}</strong>. Save it to enable client booking.
                                </p>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <Select value={timezone} onValueChange={setTimezoneState}>
                                <SelectTrigger className="w-72">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIMEZONES.map((tz) => (
                                        <SelectItem key={tz} value={tz}>
                                            <span>{tz}</span>
                                            <span className="ml-2 text-muted-foreground">{getUtcOffset(tz)}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                size="sm"
                                onClick={handleSaveTimezone}
                                disabled={savingTz || timezone === (user?.timezone ?? "")}
                            >
                                {savingTz && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Save
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Weekly Schedule ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarClock className="h-4 w-4" />
                            Weekly Schedule
                            <HintPopover
                                title="Weekly Schedule"
                                description="Defines the recurring hours each week when clients can book 1-hour appointments with you through the client portal."
                                tips={[
                                    { text: "Click a day name to toggle it on or off." },
                                    { text: "Each active day generates 1-hour slots from start to end hour." },
                                    { text: "Slots within 1 hour of now are excluded from booking automatically." },
                                    { text: "Slots already taken by confirmed appointments are hidden." },
                                ]}
                                accent="purple"
                                side="right"
                            />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Choose which days and hours clients can book appointments with you.
                            All appointment types share this schedule.
                        </p>
                        <div className="space-y-3">
                            {DAYS.map((label, day) => {
                                const w = windows.find((w) => w.dayOfWeek === day);
                                const active = !!w;
                                return (
                                    <div key={day} className="flex items-center gap-3">
                                        <div
                                            onClick={() => toggleDay(day)}
                                            className={`w-12 h-8 rounded text-xs font-medium flex items-center justify-center cursor-pointer select-none transition-colors ${
                                                active
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                                            }`}
                                        >
                                            {label}
                                        </div>
                                        {active && w ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <Select
                                                    value={String(w.startHour)}
                                                    onValueChange={(v) => updateWindow(day, "startHour", parseInt(v))}
                                                >
                                                    <SelectTrigger className="h-8 w-24 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {hours.slice(0, 24).map((h) => (
                                                            <SelectItem key={h} value={String(h)}>
                                                                {String(h).padStart(2, "0")}:00
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <span className="text-xs text-muted-foreground">to</span>
                                                <Select
                                                    value={String(w.endHour)}
                                                    onValueChange={(v) => updateWindow(day, "endHour", parseInt(v))}
                                                >
                                                    <SelectTrigger className="h-8 w-24 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {hours.slice(1).map((h) => (
                                                            <SelectItem key={h} value={String(h)} disabled={h <= w.startHour}>
                                                                {String(h).padStart(2, "0")}:00
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <span className="text-xs text-muted-foreground">
                                                    {w.endHour - w.startHour}h
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Unavailable</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <Button size="sm" onClick={handleSaveWindows} disabled={savingWindows}>
                            {savingWindows && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Save Schedule
                        </Button>
                    </CardContent>
                </Card>

                {/* ── Time Exclusions ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Ban className="h-4 w-4" />
                            Time Exclusions
                            <HintPopover
                                title="Time Exclusions"
                                description="Block specific hours on recurring days within your availability windows. Clients cannot book those hours even if they fall within your weekly schedule."
                                tips={[
                                    { text: "Use for lunch breaks, team stand-ups, or recurrent commitments." },
                                    { text: "Exclusions only subtract from existing availability windows — they do not affect days you haven't enabled." },
                                    { text: "Changes take effect immediately for future bookings." },
                                ]}
                                accent="amber"
                                side="right"
                            />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Block recurring hours within your weekly schedule (e.g. lunch break, team meetings).
                        </p>

                        {/* Single add row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Select value={String(addExclDay)} onValueChange={(v) => setAddExclDay(parseInt(v))}>
                                <SelectTrigger className="h-9 w-24 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DAYS.map((label, i) => (
                                        <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={String(addExclStart)} onValueChange={(v) => setAddExclStart(parseInt(v))}>
                                <SelectTrigger className="h-9 w-24 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 24 }, (_, h) => (
                                        <SelectItem key={h} value={String(h)}>
                                            {String(h).padStart(2, "0")}:00
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-sm text-muted-foreground">to</span>
                            <Select value={String(addExclEnd)} onValueChange={(v) => setAddExclEnd(parseInt(v))}>
                                <SelectTrigger className="h-9 w-24 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                                        <SelectItem key={h} value={String(h)} disabled={h <= addExclStart}>
                                            {String(h).padStart(2, "0")}:00
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                size="sm"
                                onClick={handleAddExclusion}
                                disabled={savingExclusionDay === addExclDay}
                            >
                                {savingExclusionDay === addExclDay
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <><Plus className="h-4 w-4 mr-1.5" />Add</>
                                }
                            </Button>
                        </div>

                        {/* Existing exclusions grouped by day */}
                        {DAYS.some((_, i) => (exclusionsByDay[i] ?? []).length > 0) ? (
                            <div className="space-y-2">
                                {DAYS.map((label, day) => {
                                    const dayWindows = exclusionsByDay[day] ?? [];
                                    if (dayWindows.length === 0) return null;
                                    return (
                                        <div key={day} className="flex items-start gap-3">
                                            <span className="text-xs font-semibold text-muted-foreground uppercase w-8 mt-1.5 shrink-0">{label}</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {dayWindows.map((w, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-2.5 py-1 font-medium"
                                                    >
                                                        {String(w.startHour).padStart(2, "0")}:00 – {String(w.endHour).padStart(2, "0")}:00
                                                        <button
                                                            onClick={() => handleRemoveExclusion(day, idx)}
                                                            className="ml-0.5 hover:text-destructive/70 transition-colors"
                                                            disabled={savingExclusionDay === day}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No exclusions set.</p>
                        )}
                    </CardContent>
                </Card>

                {/* ── Blackout Dates ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarX className="h-4 w-4" />
                            Blackout Dates
                            <HintPopover
                                title="Blackout Dates"
                                description="Specific dates where you are completely unavailable. No booking slots will be shown to clients on these dates, regardless of your weekly schedule."
                                tips={[
                                    { text: "Use for vacations, public holidays, training days, or sick leave." },
                                    { text: "Blackout dates also disable those dates in the internal appointment date picker." },
                                    { text: "Adding a reason is optional but helpful for your own records." },
                                ]}
                                accent="rose"
                                side="right"
                            />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Block specific dates (vacation, sick leave, etc.). No slots will be available to clients on these days.
                        </p>

                        {/* Add blackout date */}
                        <div className="flex items-end gap-3 flex-wrap">
                            <div className="grid gap-1.5">
                                <Label className="text-xs">Date</Label>
                                <Input
                                    type="date"
                                    value={blackoutDate}
                                    onChange={(e) => setBlackoutDate(e.target.value)}
                                    min={todayStr}
                                    className="w-44"
                                />
                            </div>
                            <div className="grid gap-1.5 flex-1 min-w-[180px]">
                                <Label className="text-xs">Reason (optional)</Label>
                                <Input
                                    value={blackoutReason}
                                    onChange={(e) => setBlackoutReason(e.target.value)}
                                    placeholder="e.g. Annual leave"
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={handleAddBlackout}
                                disabled={!blackoutDate || addingBlackout}
                            >
                                {addingBlackout && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Add
                            </Button>
                        </div>

                        {/* Existing blackout dates */}
                        {blackoutDates && blackoutDates.length > 0 ? (
                            <div className="space-y-2">
                                {blackoutDates.map((b) => (
                                    <div
                                        key={b._id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{b.date}</p>
                                            {b.reason && (
                                                <p className="text-xs text-muted-foreground mt-0.5">{b.reason}</p>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => handleRemoveBlackout(b._id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No blackout dates set.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </RoleGuard>
    );
}
