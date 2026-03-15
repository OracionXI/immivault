"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2, Shield, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PermissionLevel = "case_manager" | "staff";

interface CustomRole {
    id: string;
    name: string;
    permissionLevel: PermissionLevel;
    isDefault: boolean;
}

const BUILT_IN_ROLES: CustomRole[] = [
    { id: "case_manager", name: "Case Manager", permissionLevel: "case_manager", isDefault: true },
    { id: "staff",        name: "Staff",         permissionLevel: "staff",         isDefault: true },
];

const FIXED_ROLE_BADGES: Record<string, { label: string; description: string }> = {
    case_manager: { label: "Case Manager level", description: "Can manage cases & appointments" },
    staff:        { label: "Staff level",         description: "Access to assigned cases only" },
};

const PERMISSION_LABELS: Record<PermissionLevel, string> = {
    case_manager: "Case Manager",
    staff: "Staff",
};

export default function RoleTypesPage() {
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);

    // Only track custom (non-default) roles in state
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
    const [newRole, setNewRole] = useState({ name: "", permissionLevel: "staff" as PermissionLevel });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings !== undefined) {
            const all = settings?.customRoles ?? BUILT_IN_ROLES;
            setCustomRoles(all.filter((r) => !r.isDefault));
        }
    }, [settings]);

    const updateRoleName = (id: string, name: string) =>
        setCustomRoles((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));

    const updateRolePermission = (id: string, permissionLevel: PermissionLevel) =>
        setCustomRoles((prev) => prev.map((r) => (r.id === id ? { ...r, permissionLevel } : r)));

    const removeRole = (id: string) =>
        setCustomRoles((prev) => prev.filter((r) => r.id !== id));

    const addRole = () => {
        const name = newRole.name.trim();
        if (!name) return;
        const id = `custom-${Date.now()}`;
        setCustomRoles((prev) => [...prev, { id, name, permissionLevel: newRole.permissionLevel, isDefault: false }]);
        setNewRole({ name: "", permissionLevel: "staff" });
    };

    const handleSave = async () => {
        const cleaned = customRoles
            .map((r) => ({ ...r, name: r.name.trim() }))
            .filter((r) => r.name.length > 0);
        setSaving(true);
        setSaved(false);
        try {
            // Always include the built-in roles so the backend invariant holds
            await updateSettings({ customRoles: [...BUILT_IN_ROLES, ...cleaned] });
            setCustomRoles(cleaned);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Role Types</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Manage the roles available in your organisation. Built-in roles cannot be changed.
                    Custom roles inherit the permissions of their assigned level. Deleting a custom role
                    automatically reassigns its members to the matching built-in role.
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Fixed roles — Admin + Case Manager + Staff */}
                <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Built-in Roles</p>
                    <div className="space-y-2">
                        {/* Admin */}
                        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-sm font-medium">Admin</span>
                            <Badge variant="secondary" className="text-xs">Full Access</Badge>
                            <span className="text-xs text-muted-foreground">(cannot be changed)</span>
                        </div>
                        {/* Case Manager + Staff */}
                        {BUILT_IN_ROLES.map((role) => (
                            <div key={role.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="flex-1 text-sm font-medium">{role.name}</span>
                                <Badge variant="secondary" className="text-xs">{FIXED_ROLE_BADGES[role.id].label}</Badge>
                                <span className="text-xs text-muted-foreground hidden sm:inline">{FIXED_ROLE_BADGES[role.id].description}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Custom roles */}
                <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Custom Roles</p>
                    <div className="space-y-2">
                        {customRoles.map((role) => (
                            <div key={role.id} className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                                <Input
                                    value={role.name}
                                    onChange={(e) => updateRoleName(role.id, e.target.value)}
                                    className="flex-1 h-9"
                                    placeholder="Role name"
                                />
                                <Select
                                    value={role.permissionLevel}
                                    onValueChange={(v) => updateRolePermission(role.id, v as PermissionLevel)}
                                >
                                    <SelectTrigger className="w-[160px] h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="case_manager">{PERMISSION_LABELS.case_manager} level</SelectItem>
                                        <SelectItem value="staff">{PERMISSION_LABELS.staff} level</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                                    onClick={() => removeRole(role.id)}
                                    title="Delete role"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}

                        {customRoles.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No custom roles yet. Add one below.
                            </p>
                        )}
                    </div>
                </div>

                {/* Add new role */}
                <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Add New Role</p>
                    <div className="flex gap-2">
                        <Input
                            value={newRole.name}
                            onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                            placeholder="Role name (e.g., Senior Consultant)"
                            className="flex-1"
                            onKeyDown={(e) => { if (e.key === "Enter") addRole(); }}
                        />
                        <Select
                            value={newRole.permissionLevel}
                            onValueChange={(v) => setNewRole({ ...newRole, permissionLevel: v as PermissionLevel })}
                        >
                            <SelectTrigger className="w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="case_manager">{PERMISSION_LABELS.case_manager} level</SelectItem>
                                <SelectItem value="staff">{PERMISSION_LABELS.staff} level</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button onClick={addRole} disabled={!newRole.name.trim()} className="gap-1 shrink-0">
                            <Plus className="h-3.5 w-3.5" />Add
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                        Permission level controls what the role can do. You can rename it freely.
                    </p>
                </div>

                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saved ? "Saved!" : "Save Roles"}
                </Button>
            </CardContent>
        </Card>
    );
}
