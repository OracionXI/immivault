"use client";

import { useState, useEffect } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Globe, Send, User, Briefcase, FileText, MapPin, StickyNote, Copy, Check } from "lucide-react";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Id } from "../../../../convex/_generated/dataModel";

type ConvexClient = NonNullable<ReturnType<typeof useQuery<typeof api.clients.queries.list>>>[number];

interface ClientModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    client: ConvexClient | null;
}

const PREFIXES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Esq.", "Prof.", "Hon."];
const MARITAL_STATUSES = ["Single", "Married", "Common-Law", "Divorced", "Separated", "Widowed"];
const LANGUAGES = ["English", "Spanish", "French", "Portuguese", "Arabic", "Mandarin", "Cantonese", "Hindi", "Tagalog", "Vietnamese", "Korean", "Other"];
const REFERRAL_SOURCES = ["Word of Mouth", "Existing Client", "Website", "Google Search", "Social Media", "Bar Referral", "Member Referral", "Community Organization", "Other"];

// ─── Field wrapper ────────────────────────────────────────────────────────────
function F({ label, id, error, hint, children }: {
    label: string; id: string; error?: string; hint?: string; children: React.ReactNode;
}) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {label}
            </Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

// ─── New Client Modal (simple) ────────────────────────────────────────────────
function NewClientModal({ onOpenChange, orgPortalReady, staff, currency }: {
    onOpenChange: (open: boolean) => void;
    orgPortalReady: boolean;
    staff: Array<{ _id: string; fullName: string; role: string }> | undefined;
    currency: string;
}) {
    const createClient = useMutation(api.clients.mutations.create);
    const [form, setForm] = useState({
        firstName: "", lastName: "", email: "", phone: "",
        status: "Active" as "Active" | "Inactive" | "Archived",
        assignedTo: "",
        contractAmount: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

    const assignableStaff = staff?.filter((u) => u.role === "admin" || u.role === "case_manager");

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.firstName.trim()) e.firstName = "Required";
        if (!form.lastName.trim()) e.lastName = "Required";
        const emailTrimmed = form.email.trim();
        if (!emailTrimmed) {
            e.email = "Required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
            e.email = "Enter a valid email address";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const contractAmountCents = form.contractAmount
                ? Math.round(parseFloat(form.contractAmount) * 100)
                : undefined;
            await createClient({
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                phone: form.phone.trim() || undefined,
                status: form.status,
                assignedTo: form.assignedTo ? (form.assignedTo as Id<"users">) : undefined,
                contractAmount: contractAmountCents,
                portalEnabled: orgPortalReady,
            });
            toast.success(
                orgPortalReady
                    ? "Client created — portal invite email sent."
                    : "Client created."
            );
            onOpenChange(false);
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle>New Client</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Enter the basics. The client will complete their profile via the portal.
                </p>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                    <F label="First Name *" id="firstName" error={errors.firstName}>
                        <Input id="firstName" value={form.firstName}
                            onChange={(e) => set("firstName", e.target.value)}
                            placeholder="Maria" autoFocus />
                    </F>
                    <F label="Last Name *" id="lastName" error={errors.lastName}>
                        <Input id="lastName" value={form.lastName}
                            onChange={(e) => set("lastName", e.target.value)}
                            placeholder="Rodriguez" />
                    </F>
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-2 gap-3">
                    <F label="Email *" id="email" error={errors.email}>
                        <Input id="email" type="email" value={form.email}
                            onChange={(e) => set("email", e.target.value)}
                            placeholder="maria@example.com" />
                    </F>
                    <F label="Phone" id="phone">
                        <Input id="phone" value={form.phone}
                            onChange={(e) => set("phone", e.target.value)}
                            placeholder="+1 555 0100" />
                    </F>
                </div>

                {/* Status + Assigned To */}
                <div className="grid grid-cols-2 gap-3">
                    <F label="Status" id="status">
                        <Select value={form.status} onValueChange={(v) => set("status", v as typeof form.status)}>
                            <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Inactive">Inactive</SelectItem>
                                <SelectItem value="Archived">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                    </F>
                    <F label="Assigned Member / Staff" id="assignedTo">
                        <Select value={form.assignedTo} onValueChange={(v) => set("assignedTo", v)}>
                            <SelectTrigger id="assignedTo"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {assignableStaff?.map((u) => (
                                    <SelectItem key={u._id} value={u._id}>{u.fullName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </F>
                </div>

                {/* Contract Amount */}
                <F label={`Contract Amount (${currency})`} id="contractAmount"
                    hint="Creates a Draft billing record for this client's contract balance.">
                    <Input id="contractAmount" type="number" min="0" step="0.01"
                        value={form.contractAmount}
                        onChange={(e) => set("contractAmount", e.target.value)}
                        placeholder="e.g., 5000.00" />
                </F>

            </div>

            <DialogFooter className="px-6 py-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="button" onClick={handleSubmit} disabled={loading}>
                    {loading ? "Creating…" : "Create Client"}
                </Button>
            </DialogFooter>
        </>
    );
}

// ─── Edit Client Modal (full tabbed profile) ──────────────────────────────────
function EditClientModal({ client, onOpenChange, orgPortalReady, portalSlug, staff, currency }: {
    client: ConvexClient;
    onOpenChange: (open: boolean) => void;
    orgPortalReady: boolean;
    portalSlug: string | undefined;
    staff: Array<{ _id: string; fullName: string; role: string }> | undefined;
    currency: string;
}) {
    const updateClient = useMutation(api.clients.mutations.update);
    const setPortalEnabled = useMutation(api.organisations.mutations.setClientPortalEnabled);
    const resendInvite = useAction(api.clients.mutations.resendPortalInvite);
    const [copied, setCopied] = useState(false);

    const [form, setForm] = useState({
        // Contact (admin-controlled)
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone ?? "",
        // Personal (client-filled)
        prefix: client.prefix ?? "",
        middleName: client.middleName ?? "",
        dateOfBirth: client.dateOfBirth ? new Date(client.dateOfBirth).toISOString().split("T")[0] : "",
        maritalStatus: client.maritalStatus ?? "",
        languagePreference: client.languagePreference ?? "",
        nationality: client.nationality ?? "",
        countryOfBirth: client.countryOfBirth ?? "",
        passportNumber: client.passportNumber ?? "",
        mobilePhone: client.mobilePhone ?? "",
        address: client.address ?? "",
        // Case (admin-controlled)
        status: client.status,
        assignedTo: client.assignedTo ?? "",
        contractAmount: client.contractAmount ? (client.contractAmount / 100).toFixed(2) : "",
        referralSource: client.referralSource ?? "",
        // Internal
        notes: client.notes ?? "",
        // Portal
        portalEnabled: client.portalEnabled ?? false,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [togglingPortal, setTogglingPortal] = useState(false);
    const [sendingInvite, setSendingInvite] = useState(false);
    const [activeTab, setActiveTab] = useState("contact");

    const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

    const handlePortalToggle = async (enabled: boolean) => {
        setTogglingPortal(true);
        try {
            await setPortalEnabled({ clientId: client._id, enabled });
            set("portalEnabled", enabled);
            toast.success(enabled ? "Portal access enabled." : "Portal access disabled.");
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setTogglingPortal(false);
        }
    };

    const portalUrl = portalSlug
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${portalSlug}`
        : undefined;

    const handleCopyLink = () => {
        if (!portalUrl) return;
        navigator.clipboard.writeText(portalUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleResendInvite = async () => {
        setSendingInvite(true);
        try {
            await resendInvite({ clientId: client._id });
            toast.success("Invite email sent.");
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSendingInvite(false);
        }
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.firstName.trim()) e.firstName = "Required";
        if (!form.lastName.trim()) e.lastName = "Required";
        const emailTrimmed = form.email.trim();
        if (!emailTrimmed) {
            e.email = "Required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
            e.email = "Enter a valid email address";
        }
        setErrors(e);
        if (Object.keys(e).length > 0) setActiveTab("contact");
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            const contractAmountCents = form.contractAmount
                ? Math.round(parseFloat(form.contractAmount) * 100)
                : undefined;
            const dobMs = form.dateOfBirth ? new Date(form.dateOfBirth).getTime() : undefined;
            await updateClient({
                id: client._id,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                phone: form.phone.trim() || undefined,
                prefix: form.prefix || undefined,
                middleName: form.middleName.trim() || undefined,
                dateOfBirth: dobMs,
                maritalStatus: form.maritalStatus || undefined,
                languagePreference: form.languagePreference || undefined,
                nationality: form.nationality.trim() || undefined,
                countryOfBirth: form.countryOfBirth.trim() || undefined,
                passportNumber: form.passportNumber.trim() || undefined,
                mobilePhone: form.mobilePhone.trim() || undefined,
                address: form.address.trim() || undefined,
                status: form.status,
                assignedTo: form.assignedTo ? (form.assignedTo as Id<"users">) : undefined,
                contractAmount: contractAmountCents,
                referralSource: form.referralSource || undefined,
                notes: form.notes.trim() || undefined,
            });
            toast.success("Client updated.");
            onOpenChange(false);
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const hasError = Object.keys(errors).length > 0;

    return (
        <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle>
                    {client.prefix ? `${client.prefix} ` : ""}{client.firstName} {client.lastName}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Client profile — all fields</p>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-6 mt-4 grid grid-cols-5 h-9 shrink-0">
                    <TabsTrigger value="contact" className="text-xs gap-1">
                        <User className="h-3.5 w-3.5" />Contact
                        {hasError && <Badge variant="destructive" className="h-4 w-4 p-0 text-[9px] flex items-center justify-center">!</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="personal" className="text-xs gap-1">
                        <FileText className="h-3.5 w-3.5" />Personal
                    </TabsTrigger>
                    <TabsTrigger value="case" className="text-xs gap-1">
                        <Briefcase className="h-3.5 w-3.5" />Case
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="text-xs gap-1">
                        <StickyNote className="h-3.5 w-3.5" />Notes
                    </TabsTrigger>
                    <TabsTrigger value="portal" className="text-xs gap-1">
                        <Globe className="h-3.5 w-3.5" />Portal
                    </TabsTrigger>
                </TabsList>

                {/* Contact */}
                <TabsContent value="contact" className="flex-1 overflow-y-auto px-6 py-5 space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-3">
                        <F label="First Name *" id="firstName" error={errors.firstName}>
                            <Input id="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                        </F>
                        <F label="Last Name *" id="lastName" error={errors.lastName}>
                            <Input id="lastName" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                        </F>
                    </div>
                    <F label="Email *" id="email" error={errors.email}>
                        <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                    </F>
                    <div className="grid grid-cols-2 gap-3">
                        <F label="Work / Home Phone" id="phone">
                            <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 0100" />
                        </F>
                        <F label="Mobile Phone" id="mobilePhone" hint="Provided by client">
                            <Input id="mobilePhone" value={form.mobilePhone} onChange={(e) => set("mobilePhone", e.target.value)} placeholder="+1 555 0200" />
                        </F>
                    </div>
                    <F label="Address" id="address" hint="Provided by client">
                        <Textarea id="address" value={form.address} onChange={(e) => set("address", e.target.value)}
                            placeholder="123 Main St, Los Angeles, CA 90001" rows={3} className="resize-none" />
                    </F>
                </TabsContent>

                {/* Personal */}
                <TabsContent value="personal" className="flex-1 overflow-y-auto px-6 py-5 space-y-4 mt-0">
                    <p className="text-xs text-muted-foreground">Filled in by the client during portal onboarding. You may also edit these.</p>
                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-3">
                            <F label="Prefix" id="prefix">
                                <Select value={form.prefix} onValueChange={(v) => set("prefix", v === "none" ? "" : v)}>
                                    <SelectTrigger id="prefix"><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {PREFIXES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </F>
                        </div>
                        <div className="col-span-9">
                            <F label="Middle Name" id="middleName">
                                <Input id="middleName" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} placeholder="Middle name" />
                            </F>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <F label="Date of Birth" id="dateOfBirth">
                            <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
                        </F>
                        <F label="Marital Status" id="maritalStatus">
                            <Select value={form.maritalStatus} onValueChange={(v) => set("maritalStatus", v === "none" ? "" : v)}>
                                <SelectTrigger id="maritalStatus"><SelectValue placeholder="Select…" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {MARITAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </F>
                    </div>
                    <F label="Preferred Language" id="languagePreference">
                        <Select value={form.languagePreference} onValueChange={(v) => set("languagePreference", v === "none" ? "" : v)}>
                            <SelectTrigger id="languagePreference"><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </F>
                    <div className="grid grid-cols-2 gap-3">
                        <F label="Country of Citizenship" id="nationality">
                            <Input id="nationality" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g., Mexico" />
                        </F>
                        <F label="Country of Birth" id="countryOfBirth">
                            <Input id="countryOfBirth" value={form.countryOfBirth} onChange={(e) => set("countryOfBirth", e.target.value)} placeholder="e.g., Guatemala" />
                        </F>
                    </div>
                    <F label="Passport / ID Number" id="passportNumber">
                        <Input id="passportNumber" value={form.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} placeholder="A12345678" />
                    </F>
                </TabsContent>

                {/* Case */}
                <TabsContent value="case" className="flex-1 overflow-y-auto px-6 py-5 space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-3">
                        <F label="Client Status" id="status">
                            <Select value={form.status} onValueChange={(v) => set("status", v as typeof form.status)}>
                                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                    <SelectItem value="Archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </F>
                        <F label="Assigned Member / Staff" id="assignedTo">
                            <Select value={form.assignedTo} onValueChange={(v) => set("assignedTo", v)}>
                                <SelectTrigger id="assignedTo"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {staff?.filter((u) => u.role === "admin" || u.role === "case_manager").map((u) => (
                                        <SelectItem key={u._id} value={u._id}>{u.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </F>
                    </div>
                    <F label={`Contract Amount (${currency})`} id="contractAmount">
                        <Input id="contractAmount" type="number" min="0" step="0.01"
                            value={form.contractAmount} onChange={(e) => set("contractAmount", e.target.value)}
                            placeholder="5000.00" />
                    </F>
                    <F label="Referral Source" id="referralSource">
                        <Select value={form.referralSource} onValueChange={(v) => set("referralSource", v === "none" ? "" : v)}>
                            <SelectTrigger id="referralSource"><SelectValue placeholder="How did they find you?" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {REFERRAL_SOURCES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </F>
                </TabsContent>

                {/* Notes */}
                <TabsContent value="notes" className="flex-1 overflow-y-auto px-6 py-5 space-y-4 mt-0">
                    <F label="Internal Notes" id="notes" hint="Confidential — visible to staff only, never shown to client.">
                        <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)}
                            placeholder="Intake notes, referral context, special circumstances…"
                            rows={8} className="resize-none" />
                    </F>
                </TabsContent>

                {/* Portal */}
                <TabsContent value="portal" className="flex-1 overflow-y-auto px-6 py-5 space-y-4 mt-0">
                    {!orgPortalReady ? (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                            <p className="text-sm font-medium text-amber-800">Portal not configured</p>
                            <p className="text-xs text-amber-700 mt-1">Enable it in Settings → Client Portal first.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                                <div>
                                    <p className="text-sm font-medium">Portal Access</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Allow this client to log in and view their cases, invoices, and appointments.
                                    </p>
                                    {client.lastPortalLogin && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Last login: {new Date(client.lastPortalLogin).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </p>
                                    )}
                                    {client.profileCompleted && (
                                        <Badge variant="secondary" className="mt-2 text-green-700 bg-green-50 border-green-200 text-xs">
                                            Profile completed
                                        </Badge>
                                    )}
                                </div>
                                <Switch
                                    checked={form.portalEnabled}
                                    onCheckedChange={handlePortalToggle}
                                    disabled={togglingPortal}
                                />
                            </div>
                            {form.portalEnabled && (
                                <div className="space-y-3">
                                    {portalUrl && (
                                        <div className="rounded-lg border bg-muted/30 p-3">
                                            <p className="text-xs text-muted-foreground mb-1.5">Portal Login URL</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs font-mono text-foreground flex-1 truncate">{portalUrl}</p>
                                                <Button type="button" variant="ghost" size="icon"
                                                    className="h-6 w-6 shrink-0" onClick={handleCopyLink}>
                                                    {copied
                                                        ? <Check className="h-3.5 w-3.5 text-green-600" />
                                                        : <Copy className="h-3.5 w-3.5" />}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    <Button type="button" variant="outline" size="sm"
                                        className="gap-1.5" onClick={handleResendInvite}
                                        disabled={sendingInvite}>
                                        <Send className="h-3.5 w-3.5" />
                                        {sendingInvite ? "Sending…" : "Resend Invite Email"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <DialogFooter className="px-6 py-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={loading}>
                    {loading ? "Saving…" : "Save Changes"}
                </Button>
            </DialogFooter>
        </>
    );
}

// ─── Root modal wrapper ───────────────────────────────────────────────────────
export function ClientModal({ open, onOpenChange, client }: ClientModalProps) {
    const portalSettings = useQuery(api.organisations.queries.getPortalSettings);
    const settings = useQuery(api.organisations.queries.getSettings);
    const staff = useQuery(api.users.queries.listByOrg);
    const currency = settings?.defaultCurrency ?? "USD";
    const orgPortalReady = !!(portalSettings?.portalEnabled && portalSettings?.portalSlug);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                style={{ maxWidth: client ? "820px" : "560px", maxHeight: "90vh" }}
                className="flex flex-col overflow-hidden p-0"
            >
                {client ? (
                    <EditClientModal
                        client={client}
                        onOpenChange={onOpenChange}
                        orgPortalReady={orgPortalReady}
                        portalSlug={portalSettings?.portalSlug ?? undefined}
                        staff={staff}
                        currency={currency}
                    />
                ) : (
                    <NewClientModal
                        onOpenChange={onOpenChange}
                        orgPortalReady={orgPortalReady}
                        staff={staff}
                        currency={currency}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
