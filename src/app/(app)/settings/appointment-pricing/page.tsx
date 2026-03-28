"use client";

import { useState } from "react";
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
import { Loader2, Plus, Trash2, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { RoleGuard } from "@/components/shared/role-guard";
import { PageHeader } from "@/components/shared/page-header";

const DEFAULT_APPOINTMENT_TYPES = ["Consultation", "Document Review", "Interview Prep", "Follow-up"];

export default function AppointmentPricingPage() {
  const pricing = useQuery(api.organisations.queries.getAppointmentPricing) ?? [];
  const settings = useQuery(api.organisations.queries.getSettings);
  const upsert = useMutation(api.organisations.mutations.upsertAppointmentPricing);
  const remove = useMutation(api.organisations.mutations.deleteAppointmentPricing);

  const appointmentTypes = settings?.appointmentTypes ?? DEFAULT_APPOINTMENT_TYPES;
  const defaultCurrency = (settings?.defaultCurrency ?? "USD").toUpperCase();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<Id<"appointmentPricing"> | null>(null);

  const [form, setForm] = useState({
    appointmentType: "",
    priceInCents: "",
    description: "",
    isActive: true,
  });

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

  const formatPrice = (cents: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

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
