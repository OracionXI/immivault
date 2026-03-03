"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";

export default function ProfilePage() {
    const org = useQuery(api.organisations.queries.mine);
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);

    const [form, setForm] = useState({
        defaultCurrency: "USD",
        taxRate: 0,
        emailFromName: "",
        emailFromAddress: "",
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Populate form once settings load
    useEffect(() => {
        if (settings) {
            setForm({
                defaultCurrency: settings.defaultCurrency ?? "USD",
                taxRate: settings.taxRate ?? 0,
                emailFromName: settings.emailFromName ?? "",
                emailFromAddress: settings.emailFromAddress ?? "",
            });
        }
    }, [settings]);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await updateSettings({
                defaultCurrency: form.defaultCurrency,
                taxRate: Number(form.taxRate),
                emailFromName: form.emailFromName || undefined,
                emailFromAddress: form.emailFromAddress || undefined,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Organisation identity (read-only — managed by Clerk) */}
            <Card>
                <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Organisation Name</Label>
                        <Input value={org?.name ?? ""} disabled className="bg-muted/50" />
                        <p className="text-xs text-muted-foreground">
                            Organisation name is managed via your Clerk dashboard.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Plan</Label>
                            <Input value={org?.plan ?? ""} disabled className="bg-muted/50 capitalize" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Slug</Label>
                            <Input value={org?.slug ?? ""} disabled className="bg-muted/50" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Billing defaults */}
            <Card>
                <CardHeader><CardTitle>Billing Defaults</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Default Currency</Label>
                            <Input
                                value={form.defaultCurrency}
                                onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value.toUpperCase() })}
                                placeholder="USD"
                                maxLength={3}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Default Tax Rate (%)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={form.taxRate}
                                onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Email sender identity */}
            <Card>
                <CardHeader><CardTitle>Email Sender Identity</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>From Name</Label>
                            <Input
                                value={form.emailFromName}
                                onChange={(e) => setForm({ ...form, emailFromName: e.target.value })}
                                placeholder="e.g. Chen Immigration Law"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>From Email Address</Label>
                            <Input
                                type="email"
                                value={form.emailFromAddress}
                                onChange={(e) => setForm({ ...form, emailFromAddress: e.target.value })}
                                placeholder="e.g. noreply@yourfirm.com"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Used as the sender identity for outgoing emails (Phase 4 — Resend integration).
                    </p>
                </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saved ? "Saved!" : "Save Changes"}
            </Button>
        </div>
    );
}
