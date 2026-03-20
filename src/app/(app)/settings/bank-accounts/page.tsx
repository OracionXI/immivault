"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Plus, Trash2, Star, StarOff, Building2 } from "lucide-react";
import { SettingsCardSkeleton } from "@/components/shared/settings-card-skeleton";

type BankAccount = NonNullable<ReturnType<typeof useQuery<typeof api.bankAccounts.queries.list>>>[number];

const emptyForm = { bankName: "", accountName: "", accountNumber: "", routingNumber: "" };

export default function BankAccountsPage() {
    const rawAccounts = useQuery(api.bankAccounts.queries.list);
    const accounts = rawAccounts ?? [];
    const createAccount = useMutation(api.bankAccounts.mutations.create);
    const setDefaultAccount = useMutation(api.bankAccounts.mutations.setDefault);
    const removeAccount = useMutation(api.bankAccounts.mutations.remove);

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: BankAccount["_id"] | null }>({ open: false, id: null });

    const handleAdd = async () => {
        setSaving(true);
        try {
            await createAccount(form);
            setModalOpen(false);
            setForm(emptyForm);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    if (rawAccounts === undefined) return <SettingsCardSkeleton rows={3} />;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />Bank Accounts
                </CardTitle>
                <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />Add Account
                </Button>
            </CardHeader>
            <CardContent>
                {accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">
                        No bank accounts added yet.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {accounts.map((account) => (
                            <div key={account._id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">{account.bankName}</p>
                                        {account.isDefault && (
                                            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{account.accountName}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Account: {account.accountNumber} · Routing: {account.routingNumber}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost" size="icon" className="h-8 w-8"
                                        onClick={() => setDefaultAccount({ id: account._id })}
                                        disabled={account.isDefault}
                                        title={account.isDefault ? "Default account" : "Set as default"}
                                    >
                                        {account.isDefault
                                            ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                            : <StarOff className="h-4 w-4 text-muted-foreground" />}
                                    </Button>
                                    <Button
                                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteDialog({ open: true, id: account._id })}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent style={{ maxWidth: "675px" }}>
                    <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Bank Name</Label>
                            <Input
                                value={form.bankName}
                                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                                placeholder="e.g. Chase Bank"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Account Name</Label>
                            <Input
                                value={form.accountName}
                                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                                placeholder="e.g. Operating Account"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Account Number</Label>
                                <Input
                                    value={form.accountNumber}
                                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                                    placeholder="****1234"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Routing Number</Label>
                                <Input
                                    value={form.routingNumber}
                                    onChange={(e) => setForm({ ...form, routingNumber: e.target.value })}
                                    placeholder="****5678"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleAdd}
                            disabled={saving || !form.bankName || !form.accountName}
                        >
                            Add Account
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
                title="Remove Bank Account"
                description="Are you sure you want to remove this bank account?"
                onConfirm={async () => {
                    if (deleteDialog.id) await removeAccount({ id: deleteDialog.id });
                    setDeleteDialog({ open: false, id: null });
                }}
            />
        </Card>
    );
}
