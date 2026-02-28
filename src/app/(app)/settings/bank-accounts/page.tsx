"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockBankAccounts } from "@/lib/mock-data";
import type { BankAccount } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Plus, Trash2, Star, StarOff, Building2 } from "lucide-react";

export default function BankAccountsPage() {
    const [accounts, setAccounts] = useState<BankAccount[]>(mockBankAccounts);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ bankName: "", accountName: "", accountNumber: "", routingNumber: "" });
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    const handleAdd = () => {
        setAccounts([...accounts, { id: `ba${Date.now()}`, ...form, isDefault: false }]);
        setModalOpen(false);
        setForm({ bankName: "", accountName: "", accountNumber: "", routingNumber: "" });
    };

    const setDefault = (id: string) => {
        setAccounts((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Bank Accounts</CardTitle>
                <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Account</Button>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {accounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                            <div>
                                <p className="font-medium">{account.bankName}</p>
                                <p className="text-sm text-muted-foreground">{account.accountName}</p>
                                <p className="text-xs text-muted-foreground mt-1">Account: {account.accountNumber} · Routing: {account.routingNumber}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDefault(account.id)}>
                                    {account.isDefault ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : <StarOff className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ open: true, id: account.id })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>Bank Name</Label><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g., Chase Bank" /></div>
                        <div className="grid gap-2"><Label>Account Name</Label><Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="e.g., ImmiVault LLC – Operating" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>Account Number</Label><Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="****1234" /></div>
                            <div className="grid gap-2"><Label>Routing Number</Label><Input value={form.routingNumber} onChange={(e) => setForm({ ...form, routingNumber: e.target.value })} placeholder="****5678" /></div>
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleAdd}>Add Account</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })} title="Remove Bank Account" description="Are you sure you want to remove this bank account?" onConfirm={() => { if (deleteDialog.id) setAccounts((prev) => prev.filter((a) => a.id !== deleteDialog.id)); setDeleteDialog({ open: false, id: null }); }} />
        </Card>
    );
}
