"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, Loader2, Lock } from "lucide-react";
import { SettingsCardSkeleton } from "@/components/shared/settings-card-skeleton";

const BUILT_IN_TYPE = "Consultation";
const DEFAULT_APPOINTMENT_TYPES = [
    "Consultation",
    "Document Review",
    "Interview Prep",
    "Follow-up",
];

export default function AppointmentTypesPage() {
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);

    const [types, setTypes] = useState<string[]>([]);
    const [newTypeName, setNewTypeName] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings !== undefined) {
            const all = settings?.appointmentTypes ?? DEFAULT_APPOINTMENT_TYPES;
            // Ensure built-in is always present
            setTypes(all.includes(BUILT_IN_TYPE) ? all : [BUILT_IN_TYPE, ...all]);
        }
    }, [settings]);

    const addType = () => {
        const name = newTypeName.trim();
        if (!name || types.includes(name)) return;
        setTypes((prev) => [...prev, name]);
        setNewTypeName("");
    };

    const updateType = (index: number, value: string) =>
        setTypes((prev) => prev.map((t, i) => (i === index ? value : t)));

    const removeType = (index: number) => {
        if (types[index] === BUILT_IN_TYPE) return;
        setTypes((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        // Always keep Consultation at front, clean empties
        const cleaned = types.map((t) => t.trim()).filter(Boolean);
        const withBuiltIn = cleaned.includes(BUILT_IN_TYPE)
            ? cleaned
            : [BUILT_IN_TYPE, ...cleaned];
        setSaving(true);
        setSaved(false);
        try {
            await updateSettings({ appointmentTypes: withBuiltIn });
            setTypes(withBuiltIn);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    if (settings === undefined) return <SettingsCardSkeleton />;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Appointment Types</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Define the appointment type categories used when scheduling meetings.
                    <strong> Consultation</strong> is built-in and cannot be removed.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add new type */}
                <div className="flex gap-2">
                    <Input
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="New type name (e.g., Case Review)"
                        className="flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter") addType(); }}
                    />
                    <Button onClick={addType} disabled={!newTypeName.trim()} className="gap-1 shrink-0">
                        <Plus className="h-3.5 w-3.5" />Add
                    </Button>
                </div>

                <div className="space-y-2">
                    {types.map((type, index) => {
                        const isBuiltIn = type === BUILT_IN_TYPE;
                        return (
                            <div key={index} className="flex items-center gap-2">
                                <Input
                                    value={type}
                                    onChange={(e) => updateType(index, e.target.value)}
                                    className="flex-1 h-9"
                                    placeholder="Type name"
                                    disabled={isBuiltIn}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0"
                                    onClick={() => removeType(index)}
                                    disabled={isBuiltIn}
                                    title={isBuiltIn ? "Built-in type — cannot be removed" : "Remove type"}
                                >
                                    {isBuiltIn
                                        ? <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                                        : <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    }
                                </Button>
                            </div>
                        );
                    })}
                </div>

                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saved ? "Saved!" : "Save Types"}
                </Button>
            </CardContent>
        </Card>
    );
}
