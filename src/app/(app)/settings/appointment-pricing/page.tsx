"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Loader2, Plus, Trash2, DollarSign, CalendarClock, Globe, ChevronDown, ChevronUp, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { RoleGuard } from "@/components/shared/role-guard";
import { PageHeader } from "@/components/shared/page-header";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "NGN", "INR"];

const DEFAULT_APPOINTMENT_TYPES = ["Consultation", "Document Review", "Interview Prep", "Follow-up"];

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

// Common IANA timezones
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Istanbul",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

type AvailWindow = { dayOfWeek: number; startHour: number; endHour: number; isActive: boolean };

function AvailabilityEditor({
  pricingId,
  onClose,
}: {
  pricingId: Id<"appointmentPricing">;
  onClose: () => void;
}) {
  const existing = useQuery(api.appointmentAvailability.queries.listByPricing, { appointmentPricingId: pricingId });
  const upsert = useMutation(api.appointmentAvailability.mutations.upsertAvailability);
  const [saving, setSaving] = useState(false);

  // Build default windows from existing (or empty defaults Mon–Fri 9–17)
  const [windows, setWindows] = useState<AvailWindow[]>(() => {
    if (existing && existing.length > 0) {
      return existing.map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startHour: w.startHour,
        endHour: w.endHour,
        isActive: w.isActive,
      }));
    }
    // Default: Mon–Fri 9am–5pm
    return [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startHour: 9, endHour: 17, isActive: true }));
  });

  const toggleDay = (day: number) => {
    const idx = windows.findIndex((w) => w.dayOfWeek === day);
    if (idx >= 0) {
      setWindows((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setWindows((prev) => [...prev, { dayOfWeek: day, startHour: 9, endHour: 17, isActive: true }].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    }
  };

  const updateWindow = (day: number, field: "startHour" | "endHour", value: number) => {
    setWindows((prev) => prev.map((w) => w.dayOfWeek === day ? { ...w, [field]: value } : w));
  };

  const hours = Array.from({ length: 25 }, (_, i) => i); // 0–24

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsert({ appointmentPricingId: pricingId, windows });
      toast.success("Availability saved.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ maxWidth: "520px" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Set Availability
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Choose which days and hours clients can book this appointment type. Hours are in your organisation&apos;s timezone.
        </p>
        <div className="space-y-3 py-2">
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Availability
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AppointmentSettingsPage() {
  const pricing = useQuery(api.organisations.queries.getAppointmentPricing) ?? [];
  const settings = useQuery(api.organisations.queries.getSettings);
  const upsert = useMutation(api.organisations.mutations.upsertAppointmentPricing);
  const remove = useMutation(api.organisations.mutations.deleteAppointmentPricing);
  const updateSettings = useMutation(api.organisations.mutations.updateSettings);

  const appointmentTypes = settings?.appointmentTypes ?? DEFAULT_APPOINTMENT_TYPES;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<Id<"appointmentPricing"> | null>(null);
  const [availPricingId, setAvailPricingId] = useState<Id<"appointmentPricing"> | null>(null);
  const defaultCurrency = (settings?.defaultCurrency ?? "USD").toUpperCase();

  const [form, setForm] = useState({
    appointmentType: "",
    priceInCents: "",
    description: "",
    isActive: true,
  });

  // Timezone
  const [timezone, setTimezone] = useState<string>("UTC");
  const [savingTz, setSavingTz] = useState(false);
  // Sync timezone from settings once loaded (useEffect avoids overriding user selection mid-render)
  useEffect(() => {
    if (settings?.timezone) {
      setTimezone(settings.timezone);
    }
  }, [settings?.timezone]);

  const handleSave = async () => {
    if (!form.appointmentType || !form.priceInCents) return;
    setSaving(true);
    try {
      await upsert({
        appointmentType: form.appointmentType,
        priceInCents: Math.round(Number(form.priceInCents) * 100),
        currency: defaultCurrency,
        description: form.description || undefined,
        isActive: form.isActive,
      });
      toast.success("Pricing saved.");
      setDialogOpen(false);
      setForm({ appointmentType: "", priceInCents: "", description: "", isActive: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove({ id: deleteId });
      toast.success("Pricing removed.");
      setDeleteId(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSaveTimezone = async () => {
    setSavingTz(true);
    try {
      await updateSettings({ timezone });
      toast.success("Timezone saved.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingTz(false);
    }
  };

  // Office Hours
  type OfficeWindow = { dayOfWeek: number; startHour: number; endHour: number; isActive: boolean };
  const [officeHours, setOfficeHours] = useState<OfficeWindow[]>(() =>
    [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startHour: 9, endHour: 17, isActive: true }))
  );
  const [savingOH, setSavingOH] = useState(false);
  useEffect(() => {
    if (settings?.officeHours) setOfficeHours(settings.officeHours);
  }, [settings?.officeHours]);

  const toggleOfficeDay = (day: number) => {
    const idx = officeHours.findIndex((w) => w.dayOfWeek === day);
    if (idx >= 0) {
      setOfficeHours((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setOfficeHours((prev) =>
        [...prev, { dayOfWeek: day, startHour: 9, endHour: 17, isActive: true }].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      );
    }
  };
  const updateOfficeWindow = (day: number, field: "startHour" | "endHour", value: number) => {
    setOfficeHours((prev) => prev.map((w) => w.dayOfWeek === day ? { ...w, [field]: value } : w));
  };
  const handleSaveOfficeHours = async () => {
    setSavingOH(true);
    try {
      await updateSettings({ officeHours });
      toast.success("Office hours saved.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingOH(false);
    }
  };

  const formatPrice = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  return (
    <RoleGuard allowedRoles={["admin"]} redirectTo="/settings">
      <div className="space-y-6">
        <PageHeader
          title="Appt Settings"
          description="Configure appointment types, pricing, availability, and timezone for the client portal."
        />

        {/* ── Timezone ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Organisation Timezone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Availability hours you configure below are interpreted in this timezone. Clients see slot times converted to their local time.
            </p>
            <div className="flex items-center gap-3">
              <Select value={timezone} onValueChange={setTimezone}>
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
                disabled={savingTz || timezone === (settings?.timezone ?? "UTC")}
              >
                {savingTz && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Office Hours ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Office Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              When clients book an in-person (offline) appointment, available slots are generated from these hours.
            </p>
            <div className="space-y-3">
              {DAYS.map((label, day) => {
                const w = officeHours.find((w) => w.dayOfWeek === day);
                const active = !!w;
                const hours = Array.from({ length: 25 }, (_, i) => i);
                return (
                  <div key={day} className="flex items-center gap-3">
                    <div
                      onClick={() => toggleOfficeDay(day)}
                      className={`w-12 h-8 rounded text-xs font-medium flex items-center justify-center cursor-pointer select-none transition-colors ${
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {label}
                    </div>
                    {active && w ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Select value={String(w.startHour)} onValueChange={(v) => updateOfficeWindow(day, "startHour", parseInt(v))}>
                          <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {hours.slice(0, 24).map((h) => (
                              <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">to</span>
                        <Select value={String(w.endHour)} onValueChange={(v) => updateOfficeWindow(day, "endHour", parseInt(v))}>
                          <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {hours.slice(1).map((h) => (
                              <SelectItem key={h} value={String(h)} disabled={h <= w.startHour}>{String(h).padStart(2, "0")}:00</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">{w.endHour - w.startHour}h</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <Button size="sm" onClick={handleSaveOfficeHours} disabled={savingOH}>
                {savingOH && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Office Hours
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Pricing + Availability ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing &amp; Availability
            </CardTitle>
            <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Pricing
            </Button>
          </CardHeader>
          <CardContent>
            {pricing.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No pricing configured yet. Add pricing for appointment types to enable client booking.
              </div>
            ) : (
              <div className="space-y-2">
                {pricing.map((p) => (
                  <div key={p._id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="font-medium text-sm">{p.appointmentType}</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="font-semibold text-sm">
                        {p.priceInCents === 0 ? "Free" : formatPrice(p.priceInCents, p.currency)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => setAvailPricingId(p._id)}
                      >
                        <CalendarClock className="h-3 w-3" />
                        Availability
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(p._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Pricing Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent style={{ maxWidth: "480px" }}>
            <DialogHeader><DialogTitle>Set Appointment Pricing</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Appointment Type</Label>
                <Select
                  value={form.appointmentType}
                  onValueChange={(v) => setForm({ ...form, appointmentType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Price (0 = Free)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.priceInCents}
                    onChange={(e) => setForm({ ...form, priceInCents: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Currency</Label>
                  <Input value={defaultCurrency} readOnly className="bg-muted text-muted-foreground cursor-default" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Description (optional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description shown to clients"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label>Active (visible to clients)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.appointmentType || form.priceInCents === ""}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Pricing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Availability Dialog */}
        {availPricingId && (
          <AvailabilityEditor
            pricingId={availPricingId}
            onClose={() => setAvailPricingId(null)}
          />
        )}

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(open) => { if (!open) setDeleteId(null); }}
          title="Remove Pricing"
          description="Remove this appointment pricing? Clients will no longer see this type in the portal."
          confirmText="Remove"
          variant="destructive"
          onConfirm={handleDelete}
        />
      </div>
    </RoleGuard>
  );
}
