"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronRight } from "lucide-react";

type CaseType = { id: string; name: string; issues: string[] };

export default function CaseTypesPage() {
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);

    const [types, setTypes] = useState<CaseType[]>([]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [newTypeName, setNewTypeName] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings?.caseTypes) {
            setTypes(settings.caseTypes);
        }
    }, [settings]);

    const toggleExpand = (id: string) =>
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const addType = () => {
        const name = newTypeName.trim();
        if (!name) return;
        const newType: CaseType = { id: crypto.randomUUID(), name, issues: [] };
        setTypes((prev) => [...prev, newType]);
        setExpandedIds((prev) => new Set(prev).add(newType.id));
        setNewTypeName("");
    };

    const updateTypeName = (id: string, name: string) =>
        setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));

    const removeType = (id: string) =>
        setTypes((prev) => prev.filter((t) => t.id !== id));

    const addIssue = (typeId: string) =>
        setTypes((prev) =>
            prev.map((t) =>
                t.id === typeId ? { ...t, issues: [...t.issues, ""] } : t
            )
        );

    const updateIssue = (typeId: string, index: number, value: string) =>
        setTypes((prev) =>
            prev.map((t) =>
                t.id === typeId
                    ? { ...t, issues: t.issues.map((iss, i) => (i === index ? value : iss)) }
                    : t
            )
        );

    const removeIssue = (typeId: string, index: number) =>
        setTypes((prev) =>
            prev.map((t) =>
                t.id === typeId
                    ? { ...t, issues: t.issues.filter((_, i) => i !== index) }
                    : t
            )
        );

    const handleSave = async () => {
        const cleaned = types
            .map((t) => ({
                id: t.id,
                name: t.name.trim(),
                issues: t.issues.map((iss) => iss.trim()).filter(Boolean),
            }))
            .filter((t) => t.name);
        setSaving(true);
        setSaved(false);
        try {
            await updateSettings({ caseTypes: cleaned });
            setTypes(cleaned);
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
                <CardTitle>Types &amp; Issues</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Define visa types and their associated issue categories.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add new type */}
                <div className="flex gap-2">
                    <Input
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="New type name (e.g., H-1B)"
                        className="flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter") addType(); }}
                    />
                    <Button onClick={addType} className="gap-1 shrink-0">
                        <Plus className="h-3.5 w-3.5" />Add Type
                    </Button>
                </div>

                {types.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        No types configured yet. Add a type above to get started.
                    </p>
                )}

                <div className="space-y-3">
                    {types.map((type) => {
                        const isExpanded = expandedIds.has(type.id);
                        return (
                            <div key={type.id} className="rounded-lg border border-border overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => toggleExpand(type.id)}
                                    >
                                        {isExpanded
                                            ? <ChevronDown className="h-3.5 w-3.5" />
                                            : <ChevronRight className="h-3.5 w-3.5" />
                                        }
                                    </Button>
                                    <Input
                                        value={type.name}
                                        onChange={(e) => updateTypeName(type.id, e.target.value)}
                                        className="flex-1 h-8 bg-transparent border-0 shadow-none focus-visible:ring-0 font-medium px-0"
                                        placeholder="Type name"
                                    />
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {type.issues.length} issue{type.issues.length !== 1 ? "s" : ""}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                                        onClick={() => removeType(type.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                {isExpanded && (
                                    <div className="px-4 py-3 space-y-2 border-t border-border">
                                        {type.issues.map((issue, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <Input
                                                    value={issue}
                                                    onChange={(e) => updateIssue(type.id, idx, e.target.value)}
                                                    placeholder="Issue name"
                                                    className="flex-1 h-8"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                                                    onClick={() => removeIssue(type.id, idx)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addIssue(type.id)}
                                            className="gap-1 mt-1"
                                        >
                                            <Plus className="h-3 w-3" />Add Issue
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {types.length > 0 && (
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saved ? "Saved!" : "Save Types & Issues"}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
