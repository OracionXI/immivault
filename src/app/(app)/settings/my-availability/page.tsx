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
import { Loader2, CalendarClock, Globe, CalendarX, Trash2, Info } from "lucide-react";
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

                {/* ── Blackout Dates ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CalendarX className="h-4 w-4" />
                            Blackout Dates
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
