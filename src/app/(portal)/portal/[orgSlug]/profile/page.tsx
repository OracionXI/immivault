"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, User } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PREFIXES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Esq.", "Prof.", "Hon."];
const MARITAL_STATUSES = ["Single", "Married", "Common-Law", "Divorced", "Separated", "Widowed"];
const LANGUAGES = [
  "English", "Spanish", "French", "Portuguese", "Arabic",
  "Mandarin", "Cantonese", "Hindi", "Tagalog", "Vietnamese", "Korean", "Other",
];

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function F({ label, id, hint, children }: {
  label: string; id: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function Section({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-2 pb-1">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = {
  firstName: string;
  lastName: string;
  prefix: string;
  middleName: string;
  dateOfBirth: string;
  maritalStatus: string;
  languagePreference: string;
  nationality: string;
  countryOfBirth: string;
  passportNumber: string;
  mobilePhone: string;
  address: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalProfilePage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", prefix: "", middleName: "", dateOfBirth: "",
    maritalStatus: "", languagePreference: "", nationality: "", countryOfBirth: "",
    passportNumber: "", mobilePhone: "", address: "",
  });
  const [clientEmail, setClientEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing profile
  useEffect(() => {
    Promise.all([
      fetch("/api/portal/me").then((r) => r.json()),
      fetch("/api/portal/profile").then((r) => r.json()),
    ])
      .then(([me, profile]) => {
        if (!me.client) { router.replace(`/portal/${orgSlug}`); return; }
        setClientEmail(profile.email ?? me.client.email ?? "");
        setForm({
          firstName: profile.firstName ?? "",
          lastName: profile.lastName ?? "",
          prefix: profile.prefix ?? "",
          middleName: profile.middleName ?? "",
          dateOfBirth: profile.dateOfBirth
            ? new Date(profile.dateOfBirth).toISOString().split("T")[0]
            : "",
          maritalStatus: profile.maritalStatus ?? "",
          languagePreference: profile.languagePreference ?? "",
          nationality: profile.nationality ?? "",
          countryOfBirth: profile.countryOfBirth ?? "",
          passportNumber: profile.passportNumber ?? "",
          mobilePhone: profile.mobilePhone ?? "",
          address: profile.address ?? "",
        });
      })
      .catch(() => router.replace(`/portal/${orgSlug}`))
      .finally(() => setLoading(false));
  }, [orgSlug, router]);

  const set = (field: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const body: Record<string, unknown> = { markComplete: true };
      if (form.firstName.trim()) body.firstName = form.firstName.trim();
      if (form.lastName.trim()) body.lastName = form.lastName.trim();
      if (form.prefix) body.prefix = form.prefix;
      if (form.middleName.trim()) body.middleName = form.middleName.trim();
      if (form.dateOfBirth) body.dateOfBirth = new Date(form.dateOfBirth).getTime();
      if (form.maritalStatus) body.maritalStatus = form.maritalStatus;
      if (form.languagePreference) body.languagePreference = form.languagePreference;
      if (form.nationality.trim()) body.nationality = form.nationality.trim();
      if (form.countryOfBirth.trim()) body.countryOfBirth = form.countryOfBirth.trim();
      if (form.passportNumber.trim()) body.passportNumber = form.passportNumber.trim();
      if (form.mobilePhone.trim()) body.mobilePhone = form.mobilePhone.trim();
      if (form.address.trim()) body.address = form.address.trim();

      const res = await fetch("/api/portal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Keep your information up-to-date to help your attorney serve you better.
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-6">

        {/* ── Section 1: About You ── */}
        <Section title="About You" description="Your personal information." />

        <div className="grid grid-cols-2 gap-4">
          <F label="First Name" id="firstName">
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="First name"
            />
          </F>
          <F label="Last Name" id="lastName">
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Last name"
            />
          </F>
        </div>

        <F label="Email Address" id="email" hint="Email cannot be changed. Contact your attorney to update it.">
          <Input id="email" type="email" value={clientEmail} disabled
            className="opacity-60 cursor-not-allowed" />
        </F>

        <div className="grid grid-cols-3 gap-4">
          <F label="Prefix" id="prefix">
            <Select value={form.prefix || "none"} onValueChange={(v) => set("prefix", v === "none" ? "" : v)}>
              <SelectTrigger id="prefix"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {PREFIXES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <div className="col-span-2">
            <F label="Middle Name" id="middleName">
              <Input
                id="middleName"
                value={form.middleName}
                onChange={(e) => set("middleName", e.target.value)}
                placeholder="Optional"
              />
            </F>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <F label="Date of Birth" id="dateOfBirth">
            <Input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </F>
          <F label="Marital Status" id="maritalStatus">
            <Select value={form.maritalStatus || "none"} onValueChange={(v) => set("maritalStatus", v === "none" ? "" : v)}>
              <SelectTrigger id="maritalStatus"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {MARITAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
        </div>

        <F label="Preferred Language" id="languagePreference">
          <Select value={form.languagePreference || "none"} onValueChange={(v) => set("languagePreference", v === "none" ? "" : v)}>
            <SelectTrigger id="languagePreference"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>

        <div className="border-t border-border pt-4" />

        {/* ── Section 2: Identity ── */}
        <Section title="Identity & Background" description="Used for case preparation and government filings." />

        <F label="Country of Citizenship" id="nationality" hint="The country that issued your passport or national ID.">
          <Input
            id="nationality"
            value={form.nationality}
            onChange={(e) => set("nationality", e.target.value)}
            placeholder="e.g., Mexico"
          />
        </F>
        <F label="Country of Birth" id="countryOfBirth">
          <Input
            id="countryOfBirth"
            value={form.countryOfBirth}
            onChange={(e) => set("countryOfBirth", e.target.value)}
            placeholder="e.g., Guatemala"
          />
        </F>
        <F label="Passport / National ID Number" id="passportNumber" hint="We keep this secure and use it only for your case.">
          <Input
            id="passportNumber"
            value={form.passportNumber}
            onChange={(e) => set("passportNumber", e.target.value)}
            placeholder="e.g., A12345678"
          />
        </F>

        <div className="border-t border-border pt-4" />

        {/* ── Section 3: Contact ── */}
        <Section title="Address & Contact" description="Where we can reach you and send official correspondence." />

        <F label="Mobile Phone" id="mobilePhone">
          <Input
            id="mobilePhone"
            type="tel"
            value={form.mobilePhone}
            onChange={(e) => set("mobilePhone", e.target.value)}
            placeholder="+1 555 0100"
          />
        </F>
        <F label="Home Address" id="address" hint="Include street, city, state/province, zip code, and country.">
          <Textarea
            id="address"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder={"123 Main St, Apt 4B\nLos Angeles, CA 90001\nUnited States"}
            rows={4}
            className="resize-none"
          />
        </F>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
