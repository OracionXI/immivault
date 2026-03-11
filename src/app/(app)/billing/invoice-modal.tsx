"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

type ConvexInvoice = NonNullable<ReturnType<typeof useQuery<typeof api.billing.queries.listInvoices>>>[number];

interface LineItem {
    description: string;
    quantity: number;
    unitPrice: number;
}

interface InvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: ConvexInvoice | null;
}

export function InvoiceModal({ open, onOpenChange, invoice }: InvoiceModalProps) {
    const createInvoice = useMutation(api.billing.mutations.createInvoice);
    const updateInvoice = useMutation(api.billing.mutations.updateInvoice);
    const clients = useQuery(api.clients.queries.listAll) ?? [];

    const [form, setForm] = useState({
        clientId: "",
        status: "Draft" as "Draft" | "Sent" | "Paid" | "Overdue",
        dueDate: "",
        taxRate: 0,
        notes: "",
    });
    const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (invoice) {
            setForm({
                clientId: invoice.clientId,
                status: invoice.status,
                dueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
                taxRate: invoice.taxRate,
                notes: invoice.notes ?? "",
            });
            // Items can't be edited post-creation; show placeholder
            setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
        } else {
            setForm({ clientId: "", status: "Draft", dueDate: "", taxRate: 0, notes: "" });
            setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
        }
        setErrors({});
    }, [invoice, open]);

    const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
        setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const totalAmount = items.reduce((sum, it) => {
        const lineTotal = it.quantity * it.unitPrice;
        return sum + lineTotal;
    }, 0);
    const taxAmount = totalAmount * (form.taxRate / 100);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.clientId) errs.clientId = "Client is required";
        if (!form.dueDate) errs.dueDate = "Due date is required";
        if (!invoice && items.some((it) => !it.description.trim())) errs.items = "All items need descriptions";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            if (invoice) {
                // Edit mode: only update header fields
                await updateInvoice({
                    id: invoice._id,
                    status: form.status,
                    dueDate: new Date(form.dueDate).getTime(),
                    notes: form.notes || undefined,
                });
            } else {
                await createInvoice({
                    clientId: form.clientId as Id<"clients">,
                    status: form.status,
                    dueDate: new Date(form.dueDate).getTime(),
                    taxRate: form.taxRate,
                    notes: form.notes || undefined,
                    items: items.map((it) => ({
                        description: it.description,
                        quantity: it.quantity,
                        unitPrice: it.unitPrice,
                    })),
                });
            }
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const isEdit = !!invoice;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? `Edit Invoice ${invoice.invoiceNumber}` : "New Invoice"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Client *</Label>
                            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })} disabled={isEdit}>
                                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                <SelectContent>
                                    {clients.map((c) => (
                                        <SelectItem key={c._id} value={c._id}>{c.firstName} {c.lastName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {["Draft", "Sent", "Paid", "Overdue"].map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Due Date *</Label>
                            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
                        </div>
                        {!isEdit && (
                            <div className="grid gap-2">
                                <Label>Tax Rate (%)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={form.taxRate}
                                    onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
                                    placeholder="0"
                                />
                            </div>
                        )}
                    </div>

                    {/* Line items — only for create */}
                    {!isEdit && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Line Items</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setItems([...items, { description: "", quantity: 1, unitPrice: 0 }])}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" />Add Item
                                </Button>
                            </div>
                            {items.map((item, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                                    <Input
                                        className="col-span-5"
                                        placeholder="Description"
                                        value={item.description}
                                        onChange={(e) => updateItem(i, "description", e.target.value)}
                                    />
                                    <Input
                                        className="col-span-2"
                                        type="number"
                                        min={1}
                                        placeholder="Qty"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
                                    />
                                    <Input
                                        className="col-span-2"
                                        type="number"
                                        min={0}
                                        placeholder="Price"
                                        value={item.unitPrice}
                                        onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))}
                                    />
                                    <div className="col-span-2 flex items-center h-9 text-sm font-medium">
                                        ${(item.quantity * item.unitPrice).toLocaleString()}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="col-span-1 h-9 w-9 text-destructive"
                                        onClick={() => items.length > 1 && setItems(items.filter((_, j) => j !== i))}
                                        disabled={items.length <= 1}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                            {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
                            <div className="space-y-1 text-right text-sm">
                                <p className="text-muted-foreground">Subtotal: ${totalAmount.toLocaleString()}</p>
                                {form.taxRate > 0 && <p className="text-muted-foreground">Tax ({form.taxRate}%): ${taxAmount.toFixed(2)}</p>}
                                <p className="font-semibold text-base">Total: ${(totalAmount + taxAmount).toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Additional notes..."
                            rows={2}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>{isEdit ? "Save Changes" : "Create Invoice"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
