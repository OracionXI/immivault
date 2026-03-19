"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2 } from "lucide-react";
import { SettingsCardSkeleton } from "@/components/shared/settings-card-skeleton";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = typeof DAYS[number];

const SLOT_DURATIONS = [
    { value: "15", label: "15 minutes" },
    { value: "30", label: "30 minutes" },
    { value: "45", label: "45 minutes" },
    { value: "60", label: "1 hour" },
    { value: "90", label: "1.5 hours" },
    { value: "120", label: "2 hours" },
];

const BUFFER_TIMES = [
    { value: "0", label: "No buffer" },
    { value: "5", label: "5 minutes" },
    { value: "10", label: "10 minutes" },
    { value: "15", label: "15 minutes" },
    { value: "30", label: "30 minutes" },
];

export default function BookingPage() {
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);

    const [bookingEnabled, setBookingEnabled] = useState(false);
    const [bookingUrl, setBookingUrl] = useState("");
    const [slotDuration, setSlotDuration] = useState("60");
    const [bufferTime, setBufferTime] = useState("10");
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("17:00");
    const [availableDays, setAvailableDays] = useState<Day[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings) {
            setBookingEnabled(settings.bookingEnabled ?? false);
            setBookingUrl(settings.bookingUrl ?? "");
            setSlotDuration(String(settings.slotDuration ?? 60));
            setBufferTime(String(settings.bufferTime ?? 10));
            setStartTime(settings.availableStartTime ?? "09:00");
            setEndTime(settings.availableEndTime ?? "17:00");
            setAvailableDays((settings.availableDays as Day[]) ?? ["Mon", "Tue", "Wed", "Thu", "Fri"]);
        }
    }, [settings]);

    const toggleDay = (day: Day) => {
        setAvailableDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
    };

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await updateSettings({
                bookingEnabled,
                bookingUrl: bookingUrl.trim() || undefined,
                slotDuration: parseInt(slotDuration, 10),
                bufferTime: parseInt(bufferTime, 10),
                availableStartTime: startTime,
                availableEndTime: endTime,
                availableDays,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    if (settings === undefined) return <SettingsCardSkeleton rows={8} />;

    return (
        <Card>
            <CardHeader><CardTitle>Booking Settings</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-sm">Enable Online Booking</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Allow clients to book appointments online.
                        </p>
                    </div>
                    <Switch checked={bookingEnabled} onCheckedChange={setBookingEnabled} />
                </div>

                {bookingEnabled && (
                    <>
                        <Separator />

                        {/* External booking URL */}
                        <div className="grid gap-2">
                            <Label>Booking Page URL (optional)</Label>
                            <Input
                                type="url"
                                value={bookingUrl}
                                onChange={(e) => setBookingUrl(e.target.value)}
                                placeholder="https://calendly.com/yourfirm"
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional: link to an external booking tool (Calendly, Cal.com, etc.).
                                Leave blank to use native slot configuration below.
                            </p>
                        </div>

                        <Separator />

                        {/* Slot configuration */}
                        <div className="space-y-4">
                            <p className="text-sm font-medium">Slot Configuration</p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Appointment Duration</Label>
                                    <Select value={slotDuration} onValueChange={setSlotDuration}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {SLOT_DURATIONS.map((d) => (
                                                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Buffer Between Slots</Label>
                                    <Select value={bufferTime} onValueChange={setBufferTime}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {BUFFER_TIMES.map((b) => (
                                                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Available From</Label>
                                    <Input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Available Until</Label>
                                    <Input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Available Days</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {DAYS.map((day) => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleDay(day)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${availableDays.includes(day)
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saved ? "Saved!" : "Save Settings"}
                </Button>
            </CardContent>
        </Card>
    );
}
