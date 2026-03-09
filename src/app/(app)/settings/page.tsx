"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2 } from "lucide-react";
import { useRole } from "@/hooks/use-role";

export default function ProfilePage() {
    const { user, isAdmin } = useRole();
    const org = useQuery(api.organisations.queries.mine);
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateProfile = useMutation(api.users.mutations.updateProfile);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);

    // Personal profile state
    const [profileForm, setProfileForm] = useState({ fullName: "" });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);

    // Org settings state (admin only)
    const [settingsForm, setSettingsForm] = useState({
        defaultCurrency: "USD",
        taxRate: 0,
        emailFromName: "",
        emailFromAddress: "",
    });
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileForm({ fullName: user.fullName ?? "" });
        }
    }, [user]);

    useEffect(() => {
        if (settings) {
            setSettingsForm({
                defaultCurrency: settings.defaultCurrency ?? "USD",
                taxRate: settings.taxRate ?? 0,
                emailFromName: settings.emailFromName ?? "",
                emailFromAddress: settings.emailFromAddress ?? "",
            });
        }
    }, [settings]);

    const handleProfileSave = async () => {
        setProfileSaving(true);
        setProfileSaved(false);
        try {
            await updateProfile({ fullName: profileForm.fullName });
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 2500);
        } finally {
            setProfileSaving(false);
        }
    };

    const handleSettingsSave = async () => {
        setSettingsSaving(true);
        setSettingsSaved(false);
        try {
            await updateSettings({
                defaultCurrency: settingsForm.defaultCurrency,
                taxRate: Number(settingsForm.taxRate),
                emailFromName: settingsForm.emailFromName || undefined,
                emailFromAddress: settingsForm.emailFromAddress || undefined,
            });
            setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 2500);
        } finally {
            setSettingsSaving(false);
        }
    };

    const roleLabel =
        user?.role === "admin" ? "Admin"
        : user?.role === "case_manager" ? "Case Manager"
        : "Staff";

    return (
        <div className="space-y-6">
            {/* Personal profile — all users */}
            <Card>
                <CardHeader><CardTitle>My Profile</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Full Name</Label>
                        <Input
                            value={profileForm.fullName}
                            onChange={(e) => setProfileForm({ fullName: e.target.value })}
                            placeholder="Your full name"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Email</Label>
                            <Input value={user?.email ?? ""} disabled className="bg-muted/50" />
                            <p className="text-xs text-muted-foreground">
                                Email is managed via your Clerk account.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label>Role</Label>
                            <div className="flex items-center h-9">
                                <Badge variant="outline" className="capitalize">{roleLabel}</Badge>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleProfileSave} disabled={profileSaving} className="gap-2">
                        {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {profileSaved ? "Saved!" : "Save Profile"}
                    </Button>
                </CardContent>
            </Card>

            {/* Organisation identity (read-only) */}
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

            {/* Admin-only: billing & email settings */}
            {isAdmin && (
                <>
                    <Card>
                        <CardHeader><CardTitle>Billing Defaults</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Default Currency</Label>
                                    <Input
                                        value={settingsForm.defaultCurrency}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, defaultCurrency: e.target.value.toUpperCase() })}
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
                                        value={settingsForm.taxRate}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, taxRate: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Email Sender Identity</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>From Name</Label>
                                    <Input
                                        value={settingsForm.emailFromName}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, emailFromName: e.target.value })}
                                        placeholder="e.g. Chen Immigration Law"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>From Email Address</Label>
                                    <Input
                                        type="email"
                                        value={settingsForm.emailFromAddress}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, emailFromAddress: e.target.value })}
                                        placeholder="e.g. noreply@yourfirm.com"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Used as the sender identity for outgoing emails (Phase 4 — Resend integration).
                            </p>
                        </CardContent>
                    </Card>

                    <Button onClick={handleSettingsSave} disabled={settingsSaving} className="gap-2">
                        {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {settingsSaved ? "Saved!" : "Save Settings"}
                    </Button>
                </>
            )}
        </div>
    );
}
