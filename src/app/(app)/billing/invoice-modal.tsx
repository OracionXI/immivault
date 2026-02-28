"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Invoice, InvoiceItem, InvoiceStatus } from "@/lib/types";
import { mockClients } from "@/lib/mock-data";
import { Plus, Trash2 } from "lucide-react";

interface InvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice | null;
    onSave: (inv: Invoice) => void;
}

export function InvoiceModal({ open, onOpenChange, invoice, onSave }: InvoiceModalProps) {
    const [form, setForm] = useState({ clientId: "", status: "Draft" as InvoiceStatus, dueDate: "", notes: "" });
    const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (invoice) {
            setForm({ clientId: invoice.clientId, status: invoice.status, dueDate: invoice.dueDate, notes: invoice.notes });
            setItems(invoice.items);
        } else {
            setForm({ clientId: "", status: "Draft", dueDate: "", notes: "" });
            setItems([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
        }
        setErrors({});
    }, [invoice, open]);

    const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
        setItems((prev) => prev.map((item, i) => {
            if (i !== index) return item;
            const updated = { ...item, [field]: value };
            updated.total = updated.quantity * updated.unitPrice;
            return updated;
        }));
    };

    const totalAmount = items.reduce((sum, it) => sum + it.total, 0);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.clientId) errs.clientId = "Client is required";
        if (!form.dueDate) errs.dueDate = "Due date is required";
        if (items.some((it) => !it.description.trim())) errs.items = "All items need descriptions";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        const client = mockClients.find((c) => c.id === form.clientId);
        const now = new Date().toISOString().split("T")[0];
        const num = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
        onSave({ id: invoice?.id || "", invoiceNumber: invoice?.invoiceNumber || num, ...form, clientName: client?.name || "", items, totalAmount, issuedDate: invoice?.issuedDate || now });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader><DialogTitle>{invoice ? "Edit Invoice" : "New Invoice"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Client *</Label>
                            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                <SelectContent>{mockClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            {errors.clientId && <p className="text-xs text-destructive">{errors.clientId}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>Due Date *</Label>
                            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
                        </div>
                    </div>
                    {/* Line Items */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between"><Label>Line Items</Label><Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, { description: "", quantity: 1, unitPrice: 0, total: 0 }])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button></div>
                        {items.map((item, i) => (
                            <div key={i} className="grid grid-cols-12 gap-2 items-start">
                                <Input className="col-span-5" placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                                <Input className="col-span-2" type="number" min={1} placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                                <Input className="col-span-2" type="number" min={0} placeholder="Price" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))} />
                                <div className="col-span-2 flex items-center h-9 text-sm font-medium">${item.total.toLocaleString()}</div>
                                <Button variant="ghost" size="icon" className="col-span-1 h-9 w-9 text-destructive" onClick={() => items.length > 1 && setItems(items.filter((_, j) => j !== i))} disabled={items.length <= 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                        ))}
                        {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
                        <div className="text-right font-semibold text-lg">Total: ${totalAmount.toLocaleString()}</div>
                    </div>
                    <div className="grid gap-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={2} /></div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>{invoice ? "Save Changes" : "Create Invoice"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
