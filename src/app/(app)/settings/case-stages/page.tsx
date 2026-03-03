"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Plus, Trash2, Save, Loader2 } from "lucide-react";

const DEFAULT_STAGES = ["New", "In Progress", "Under Review", "Approved", "Closed"];

export default function CaseStagesPage() {
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);

    const [stages, setStages] = useState<string[]>(DEFAULT_STAGES);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings?.caseStages && settings.caseStages.length > 0) {
            setStages(settings.caseStages);
        }
    }, [settings]);

    const addStage = () => setStages((prev) => [...prev, ""]);

    const updateStage = (index: number, value: string) =>
        setStages((prev) => prev.map((s, i) => (i === index ? value : s)));

    const removeStage = (index: number) =>
        setStages((prev) => prev.filter((_, i) => i !== index));

    const handleSave = async () => {
        const cleaned = stages.map((s) => s.trim()).filter(Boolean);
        setSaving(true);
        setSaved(false);
        try {
            await updateSettings({ caseStages: cleaned });
            setStages(cleaned);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Case Stages</CardTitle>
                <Button size="sm" onClick={addStage} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />Add Stage
                </Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {stages.map((stage, index) => (
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
                                disabled={stages.length <= 1}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
                <Button onClick={handleSave} disabled={saving} className="mt-4 gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saved ? "Saved!" : "Save Stages"}
                </Button>
            </CardContent>
        </Card>
    );
}
