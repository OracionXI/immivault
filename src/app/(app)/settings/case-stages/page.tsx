"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockCaseStages } from "@/lib/mock-data";
import type { CaseStageConfig } from "@/lib/types";
import { GripVertical, Plus, Trash2, Save } from "lucide-react";

export default function CaseStagesPage() {
    const [stages, setStages] = useState<CaseStageConfig[]>(mockCaseStages);

    const addStage = () => {
        setStages([...stages, { id: `st${Date.now()}`, name: "", color: "#6b7280", order: stages.length + 1 }]);
    };

    const updateStage = (id: string, field: keyof CaseStageConfig, value: string | number) => {
        setStages((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    };

    const removeStage = (id: string) => {
        setStages((prev) => prev.filter((s) => s.id !== id));
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Case Stages</CardTitle>
                <Button size="sm" onClick={addStage} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Stage</Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {stages.map((stage) => (
                        <div key={stage.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                            <input type="color" value={stage.color} onChange={(e) => updateStage(stage.id, "color", e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
                            <Input value={stage.name} onChange={(e) => updateStage(stage.id, "name", e.target.value)} placeholder="Stage name" className="flex-1" />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" onClick={() => removeStage(stage.id)} disabled={stages.length <= 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                    ))}
                </div>
                <Button className="mt-4 gap-2"><Save className="h-4 w-4" />Save Stages</Button>
            </CardContent>
        </Card>
    );
}
