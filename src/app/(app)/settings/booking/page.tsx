"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { mockBookingSettings } from "@/lib/mock-data";
import { Save } from "lucide-react";

const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function BookingPage() {
    const [settings, setSettings] = useState(mockBookingSettings);

    const toggleDay = (day: string) => {
        setSettings((prev) => ({
            ...prev,
            availableDays: prev.availableDays.includes(day)
                ? prev.availableDays.filter((d) => d !== day)
                : [...prev.availableDays, day],
        }));
    };

    return (
        <Card>
            <CardHeader><CardTitle>Booking Settings</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Slot Duration (minutes)</Label>
                        <Select value={String(settings.slotDuration)} onValueChange={(v) => setSettings({ ...settings, slotDuration: Number(v) })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{[15, 30, 45, 60, 90, 120].map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Buffer Time (minutes)</Label>
                        <Select value={String(settings.bufferTime)} onValueChange={(v) => setSettings({ ...settings, bufferTime: Number(v) })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{[0, 5, 10, 15, 30].map((d) => <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Start Time</Label><Input type="time" value={settings.startTime} onChange={(e) => setSettings({ ...settings, startTime: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>End Time</Label><Input type="time" value={settings.endTime} onChange={(e) => setSettings({ ...settings, endTime: e.target.value })} /></div>
                </div>
                <div className="grid gap-2">
                    <Label>Max Advance Booking (days)</Label>
                    <Input type="number" value={settings.maxAdvanceBooking} onChange={(e) => setSettings({ ...settings, maxAdvanceBooking: Number(e.target.value) })} className="w-32" />
                </div>
                <div className="grid gap-3">
                    <Label>Available Days</Label>
                    <div className="flex flex-wrap gap-3">
                        {allDays.map((day) => (
                            <label key={day} className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox checked={settings.availableDays.includes(day)} onCheckedChange={() => toggleDay(day)} />
                                {day}
                            </label>
                        ))}
                    </div>
                </div>
                <Button className="gap-2"><Save className="h-4 w-4" />Save Settings</Button>
            </CardContent>
        </Card>
    );
}
