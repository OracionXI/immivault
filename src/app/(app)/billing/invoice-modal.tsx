"use client";

import { useState, useEffect, useMemo } from "react";
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
import { useCurrency } from "@/hooks/use-currency";
import { formatCurrency } from "@/lib/utils";

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
    const currency = useCurrency();
    const createInvoice = useMutation(api.billing.mutations.createInvoice);
    const updateInvoice = useMutation(api.billing.mutations.updateInvoice);
    const invoiceDetail = useQuery(
        api.billing.queries.getInvoice,
        invoice ? { id: invoice._id } : "skip"
    );
    const clients = useQuery(api.clients.queries.listAll) ?? [];
    const allCases = useQuery(api.cases.queries.listAll) ?? [];

    const [form, setForm] = useState({
        clientId: "",
        caseId: "",
        status: "Draft" as "Draft" | "Sent" | "Paid" | "Overdue",
        dueDate: "",
        taxRate: 0,
        notes: "",
    });
    const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    const filteredCases = useMemo(
        () => allCases.filter((c) => c.clientId === form.clientId),
        [allCases, form.clientId]
    );

    useEffect(() => {
        if (invoice) {
            setForm({
                clientId: invoice.clientId,
                caseId: invoice.caseId ?? "",
                status: invoice.status,
                dueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
                taxRate: invoice.taxRate,
                notes: invoice.notes ?? "",
            });
            setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
        } else {
            setForm({ clientId: "", caseId: "", status: "Draft", dueDate: "", taxRate: 0, notes: "" });
            setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
        }
        setErrors({});
    }, [invoice, open]);

    const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
        setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.clientId) errs.clientId = "Client is required";
        if (!form.dueDate) errs.dueDate = "Due date is required";
        if (!invoice && !items[0].description.trim()) errs.items = "Description is required";
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
                    caseId: form.caseId ? (form.caseId as Id<"cases">) : undefined,
                });
            } else {
                await createInvoice({
                    clientId: form.clientId as Id<"clients">,
                    caseId: form.caseId ? (form.caseId as Id<"cases">) : undefined,
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
            <DialogContent style={{ maxWidth: "900px" }}>
                <DialogHeader>
                    <DialogTitle>{isEdit ? `Edit Invoice ${invoice.invoiceNumber}` : "New Invoice"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Client *</Label>
                            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v, caseId: "" })} disabled={isEdit}>
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

                    {/* Case selector — always shown */}
                    <div className="grid gap-2">
                        <Label>Case (optional)</Label>
                        <Select
                            value={form.caseId}
                            onValueChange={(v) => setForm({ ...form, caseId: v === "__none__" ? "" : v })}
                            disabled={!form.clientId || filteredCases.length === 0}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={form.clientId ? (filteredCases.length === 0 ? "No cases for this client" : "Select a case") : "Select a client first"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {filteredCases.map((c) => (
                                    <SelectItem key={c._id} value={c._id}>{c.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description + amount — only for create */}
                    {!isEdit && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Description *</Label>
                                    <Input
                                        placeholder="e.g. Legal consultation"
                                        value={items[0].description}
                                        onChange={(e) => updateItem(0, "description", e.target.value)}
                                    />
                                    {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
                                </div>
                                <div className="grid gap-2">
                                    <Label>Amount *</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="0.00"
                                        value={items[0].unitPrice || ""}
                                        onChange={(e) => updateItem(0, "unitPrice", Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            {(items[0].unitPrice > 0 || form.taxRate > 0) && (
                                <div className="space-y-1 text-right text-sm">
                                    <p className="text-muted-foreground">Subtotal: {formatCurrency(items[0].unitPrice, currency)}</p>
                                    {form.taxRate > 0 && (
                                        <p className="text-muted-foreground">
                                            Tax ({form.taxRate}%): {formatCurrency(items[0].unitPrice * form.taxRate / 100, currency)}
                                        </p>
                                    )}
                                    <p className="font-semibold text-base">
                                        Total: {formatCurrency(items[0].unitPrice * (1 + form.taxRate / 100), currency)}
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Show existing line items (read-only) when editing */}
                    {isEdit && invoiceDetail?.items && invoiceDetail.items.length > 0 && (
                        <div className="grid gap-2">
                            <Label className="text-muted-foreground text-xs">Line Items (read-only)</Label>
                            <div className="rounded-md border divide-y text-sm bg-muted/30">
                                {invoiceDetail.items.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                                        <span className="flex-1 text-muted-foreground">{item.description}</span>
                                        <span className="text-xs text-muted-foreground shrink-0">× {item.quantity}</span>
                                        <span className="font-medium shrink-0">{formatCurrency(item.unitPrice, currency)}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">Line items cannot be modified after creation.</p>
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
