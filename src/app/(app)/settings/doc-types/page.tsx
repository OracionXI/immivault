"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";

const DEFAULT_DOC_TYPES = ["Identity", "Employment", "Immigration", "Education", "Financial", "Supporting"];

export default function DocTypesPage() {
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);

    const [types, setTypes] = useState<string[]>([]);
    const [newTypeName, setNewTypeName] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings !== undefined) {
            setTypes(settings?.documentTypes ?? DEFAULT_DOC_TYPES);
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

    const removeType = (index: number) =>
        setTypes((prev) => prev.filter((_, i) => i !== index));

    const handleSave = async () => {
        const cleaned = types.map((t) => t.trim()).filter(Boolean);
        setSaving(true);
        setSaved(false);
        try {
            await updateSettings({ documentTypes: cleaned });
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
                <CardTitle>Document Types</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Define the document type categories available when uploading or editing documents.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add new type */}
                <div className="flex gap-2">
                    <Input
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="New type name (e.g., Medical)"
                        className="flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter") addType(); }}
                    />
                    <Button onClick={addType} className="gap-1 shrink-0">
                        <Plus className="h-3.5 w-3.5" />Add
                    </Button>
                </div>

                {types.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        No types configured. Add one above or save to restore defaults.
                    </p>
                )}

                <div className="space-y-2">
                    {types.map((type, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input
                                value={type}
                                onChange={(e) => updateType(index, e.target.value)}
                                className="flex-1 h-9"
                                placeholder="Type name"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                                onClick={() => removeType(index)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>

                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saved ? "Saved!" : "Save Types"}
                </Button>
            </CardContent>
        </Card>
    );
}
