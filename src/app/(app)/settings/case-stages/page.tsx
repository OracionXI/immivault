"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Plus, Trash2, Save, Loader2, Lock } from "lucide-react";

export const FIXED_STAGES = ["To Do", "In Progress", "On Hold", "Completed", "Archive"];

export default function CaseStagesPage() {
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);

    // Only custom (non-fixed) stages are stored and managed here
    const [customStages, setCustomStages] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings !== undefined) {
            const stored = settings?.caseStages ?? [];
            // Filter out any fixed stages that may have been saved previously
            setCustomStages(stored.filter((s) => !FIXED_STAGES.includes(s)));
        }
    }, [settings]);

    const addStage = () => setCustomStages((prev) => [...prev, ""]);

    const updateStage = (index: number, value: string) =>
        setCustomStages((prev) => prev.map((s, i) => (i === index ? value : s)));

    const removeStage = (index: number) =>
        setCustomStages((prev) => prev.filter((_, i) => i !== index));

    const handleSave = async () => {
        const cleaned = customStages.map((s) => s.trim()).filter(Boolean);
        setSaving(true);
        setSaved(false);
        try {
            await updateSettings({ caseStages: cleaned });
            setCustomStages(cleaned);
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
                <CardTitle>Case Stages</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Define the stages that appear as columns on the Cases Kanban board.
                    The default stages below are always present and cannot be removed.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Fixed stages — read-only */}
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Default Stages
                    </p>
                    {FIXED_STAGES.map((stage) => (
                        <div
                            key={stage}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/40"
                        >
                            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-sm text-muted-foreground">{stage}</span>
                        </div>
                    ))}
                </div>

                {/* Custom stages — editable */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Custom Stages
                        </p>
                        <Button size="sm" onClick={addStage} className="gap-1">
                            <Plus className="h-3.5 w-3.5" />Add Stage
                        </Button>
                    </div>

                    {customStages.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">
                            No custom stages yet. Click &quot;Add Stage&quot; to create one.
                        </p>
                    )}

                    {customStages.map((stage, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                            <Input
                                value={stage}
                                onChange={(e) => updateStage(index, e.target.value)}
                                placeholder="Stage name"
                                className="flex-1"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                                onClick={() => removeStage(index)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>

                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saved ? "Saved!" : "Save Stages"}
                </Button>
            </CardContent>
        </Card>
    );
}
