"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Loader2, Plus, Pencil, Trash2, DollarSign, Lock } from "lucide-react";
import { HintPopover } from "@/components/shared/hint-popover";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { RoleGuard } from "@/components/shared/role-guard";
import { PageHeader } from "@/components/shared/page-header";

const DEFAULT_APPOINTMENT_TYPES = ["Consultation", "Document Review", "Interview Prep", "Follow-up"];

type PricingRow = NonNullable<ReturnType<typeof useQuery<typeof api.organisations.queries.getAppointmentPricing>>>[number];

export default function AppointmentPricingPage() {
  const pricing = useQuery(api.organisations.queries.getAppointmentPricing) ?? [];
  const settings = useQuery(api.organisations.queries.getSettings);
  const upsert = useMutation(api.organisations.mutations.upsertAppointmentPricing);
  const remove = useMutation(api.organisations.mutations.deleteAppointmentPricing);

  const appointmentTypes = settings?.appointmentTypes ?? DEFAULT_APPOINTMENT_TYPES;
  const defaultCurrency = (settings?.defaultCurrency ?? "USD").toUpperCase();
  const stripeReady = !!(settings?.stripeEnabled);

  // Seed "Consultation" at $0 for existing orgs that pre-date this feature
  const seedCalledRef = useRef(false);
  useEffect(() => {
    if (seedCalledRef.current) return;
    if (pricing.length === 0) return; // still loading — [] is the default
    const hasConsultation = pricing.some((p) => p.appointmentType === "Consultation");
    if (hasConsultation) return;
    seedCalledRef.current = true;
    upsert({
      appointmentType: "Consultation",
      priceInCents: 0,
      currency: defaultCurrency,
      description: "Initial consultation — free of charge.",
      isActive: true,
    }).catch(() => {});
  }, [pricing, defaultCurrency, upsert]);

  // Dialog: null = closed, undefined = new, PricingRow = editing existing
  const [editing, setEditing] = useState<PricingRow | null | undefined>(undefined);
  const isDialogOpen = editing !== undefined;
  const isEditing = editing !== null && editing !== undefined;

  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<Id<"appointmentPricing"> | null>(null);

  const [form, setForm] = useState({
    appointmentType: "",
    priceInCents: "",
    description: "",
    isActive: true,
  });

  const openAdd = () => {
    setForm({ appointmentType: "", priceInCents: "", description: "", isActive: true });
    setEditing(null);
  };

  const openEdit = (row: PricingRow) => {
    setForm({
      appointmentType: row.appointmentType,
      priceInCents: row.priceInCents === 0 ? "0" : String(row.priceInCents / 100),
      description: row.description ?? "",
      isActive: row.isActive,
    });
    setEditing(row);
  };

  const closeDialog = () => {
    setEditing(undefined);
    setForm({ appointmentType: "", priceInCents: "", description: "", isActive: true });
  };

  const handleSave = async () => {
    if (!form.appointmentType || form.priceInCents === "") return;
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
      closeDialog();
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

  const formatPrice = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

  // Types available for "Add" — exclude any that already have a pricing row
  const pricedTypes = new Set(pricing.map((p) => p.appointmentType));
  const addableTypes = appointmentTypes.filter((t) => !pricedTypes.has(t));

  return (
    <RoleGuard allowedRoles={["admin"]} redirectTo="/settings">
      <div className="space-y-6">
        <PageHeader
          title="Appointment Pricing"
          description="Configure pricing for appointment types shown in the client portal. Each case manager sets their own availability in My Availability."
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing
              <HintPopover
                title="Appointment Pricing"
                description="Set a price per appointment type. These prices are shown to clients when they book through the client portal."
                tips={[
                    { text: "Only active pricing entries are visible to clients." },
                    { text: "Appointment types without a pricing entry cannot be booked via the portal." },
                    { text: "Currency is inherited from your Billing Defaults setting." },
                    { text: "You can add an optional description to explain what is included." },
                ]}
                accent="green"
                side="right"
              />
            </CardTitle>
            {addableTypes.length > 0 && (
              <Button
                size="sm"
                className="gap-2"
                onClick={openAdd}
                disabled={!stripeReady}
                title={!stripeReady ? "Configure Stripe in Payments → Settings before adding paid pricing" : undefined}
              >
                <Plus className="h-4 w-4" />
                Add Pricing
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pricing.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No pricing configured yet. Add pricing for appointment types to enable client booking.
              </div>
            ) : (
              <div className="space-y-2">
                {pricing.map((p) => {
                  const isProtected = p.appointmentType === "Consultation";
                  return (
                    <div key={p._id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm">{p.appointmentType}</p>
                            {isProtected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                <Lock className="h-2.5 w-2.5" />
                                Protected
                              </span>
                            )}
                          </div>
                          {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className="font-semibold text-sm">
                          {p.priceInCents === 0 ? "Free" : formatPrice(p.priceInCents, p.currency)}
                        </span>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => openEdit(p)}
                          disabled={!stripeReady}
                          title={!stripeReady ? "Configure Stripe in Payments → Settings before editing pricing" : undefined}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {!isProtected && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(p._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add / Edit Pricing Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent style={{ maxWidth: "480px" }}>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Pricing" : "Add Pricing"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Appointment Type</Label>
                {isEditing ? (
                  // Type is locked when editing — you can't change what type this pricing is for
                  <Input value={form.appointmentType} readOnly className="bg-muted text-muted-foreground cursor-default" />
                ) : (
                  <Select
                    value={form.appointmentType}
                    onValueChange={(v) => setForm({ ...form, appointmentType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {addableTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
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
