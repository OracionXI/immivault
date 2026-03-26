"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RoleGuard } from "@/components/shared/role-guard";
import { ArrowLeft, Plus, Loader2, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

type BankTransaction = NonNullable<ReturnType<typeof useQuery<typeof api.bankTransactions.queries.listByAccount>>>[number];

function formatTs(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BankAccountPage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.accountId as Id<"bankAccounts">;
    const orgCurrency = useCurrency();

    const bankAccounts = useQuery(api.bankAccounts.queries.list) ?? [];
    const account = bankAccounts.find((a) => a._id === accountId);
    const transactions = useQuery(api.bankTransactions.queries.listByAccount, { bankAccountId: accountId }) ?? [];

    const createTransaction = useMutation(api.bankTransactions.mutations.create);
    const removeTransaction = useMutation(api.bankTransactions.mutations.remove);

    const [createOpen, setCreateOpen] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [createForm, setCreateForm] = useState({
        type: "money_in" as "money_in" | "money_out",
        amount: "",
        description: "",
        reference: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
    });
    const [deleteId, setDeleteId] = useState<Id<"bankTransactions"> | null>(null);

    const accountCurrency = account?.currency ?? orgCurrency;

    const totalCredits = transactions.filter((t) => t.type === "money_in").reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = transactions.filter((t) => t.type === "money_out").reduce((sum, t) => sum + t.amount, 0);
    const balance = totalCredits - totalDebits;

    const handleCreate = async () => {
        if (!createForm.amount || !createForm.description || !createForm.date) return;
        setCreateLoading(true);
        try {
            await createTransaction({
                bankAccountId: accountId,
                type: createForm.type,
                amount: Math.round(Number(createForm.amount) * 100),
                currency: accountCurrency,
                description: createForm.description,
                reference: createForm.reference || undefined,
                date: new Date(createForm.date).getTime(),
                notes: createForm.notes || undefined,
            });
            toast.success("Transaction recorded.");
            setCreateOpen(false);
            setCreateForm({ type: "money_in", amount: "", description: "", reference: "", date: new Date().toISOString().split("T")[0], notes: "" });
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await removeTransaction({ id: deleteId });
            toast.success("Transaction deleted.");
            setDeleteId(null);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const columns: Column<BankTransaction>[] = [
        {
            key: "date",
            label: "Date",
            sortable: true,
            render: (t) => <span>{formatTs(t.date)}</span>,
        },
        {
            key: "description",
            label: "Description",
            render: (t) => <span className="font-medium">{t.description}</span>,
        },
        {
            key: "reference",
            label: "Reference",
            render: (t) => <span className="font-mono text-sm text-muted-foreground">{t.reference ?? "—"}</span>,
        },
        {
            key: "type",
            label: "Type",
            render: (t) => (
                <div className="flex items-center gap-1.5">
                    {t.type === "money_in"
                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                    <StatusBadge status={t.type === "money_in" ? "Money In" : "Money Out"} />
                </div>
            ),
        },
        {
            key: "amount",
            label: "Amount",
            sortable: true,
            render: (t) => (
                <span className={`font-semibold ${t.type === "money_in" ? "text-emerald-600" : "text-destructive"}`}>
                    {t.type === "money_out" ? "−" : "+"}{formatCurrency(t.amount / 100, t.currency)}
                </span>
            ),
        },
        {
            key: "notes",
            label: "Notes",
            render: (t) => <span className="text-sm text-muted-foreground">{t.notes ?? "—"}</span>,
        },
        {
            key: "actions",
            label: "",
            render: (t) => (
                <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(t._id)}
                        title="Delete transaction"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <RoleGuard allowedRoles={["admin", "accountant"]} redirectTo="/dashboard">
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/payments")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <PageHeader
                        title={account ? `${account.bankName} — ${account.accountName}` : "Bank Account"}
                        description={account ? `••••${account.accountNumber.slice(-4)} · ${accountCurrency}` : "Loading..."}
                    />
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border bg-card p-4 space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Money In</p>
                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalCredits / 100, accountCurrency)}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Money Out</p>
                        <p className="text-xl font-bold text-destructive">{formatCurrency(totalDebits / 100, accountCurrency)}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4 space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance</p>
                        <p className={`text-xl font-bold ${balance >= 0 ? "text-foreground" : "text-destructive"}`}>
                            {formatCurrency(balance / 100, accountCurrency)}
                        </p>
                    </div>
                </div>

                <DataTable<BankTransaction>
                    data={transactions}
                    columns={columns}
                    searchKey="description"
                    searchPlaceholder="Search transactions..."
                    filterDropdown={{
                        key: "type",
                        placeholder: "All Types",
                        options: [
                            { label: "Money In", value: "money_in" },
                            { label: "Money Out", value: "money_out" },
                        ],
                    }}
                    headerAction={
                        <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-4 w-4" />
                            New Transaction
                        </Button>
                    }
                />

                {/* Create Transaction Modal */}
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogContent style={{ maxWidth: "560px" }}>
                        <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Type</Label>
                                    <Select value={createForm.type} onValueChange={(v) => setCreateForm({ ...createForm, type: v as "money_in" | "money_out" })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="money_in">Money In</SelectItem>
                                            <SelectItem value="money_out">Money Out</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Amount ({accountCurrency})</Label>
                                    <Input
                                        type="number"
                                        value={createForm.amount}
                                        onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Date</Label>
                                    <Input
                                        type="date"
                                        value={createForm.date}
                                        onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Reference (optional)</Label>
                                    <Input
                                        value={createForm.reference}
                                        onChange={(e) => setCreateForm({ ...createForm, reference: e.target.value })}
                                        placeholder="Ref / check number"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Description</Label>
                                <Input
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                    placeholder="What is this transaction for?"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Notes (optional)</Label>
                                <Textarea
                                    value={createForm.notes}
                                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                                    placeholder="Additional notes..."
                                    rows={2}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button
                                onClick={handleCreate}
                                disabled={createLoading || !createForm.amount || !createForm.description || !createForm.date}
                            >
                                {createLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Record Transaction
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <ConfirmDialog
                    open={!!deleteId}
                    onOpenChange={(open) => { if (!open) setDeleteId(null); }}
                    title="Delete Transaction"
                    description="Are you sure you want to delete this transaction? This action cannot be undone."
                    confirmText="Delete"
                    variant="destructive"
                    onConfirm={handleDelete}
                />
            </div>
        </RoleGuard>
    );
}
