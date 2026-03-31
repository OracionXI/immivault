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
import { ChevronRight, ChevronLeft, Check, User, Globe, MapPin } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PREFIXES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Esq.", "Prof.", "Hon."];
const MARITAL_STATUSES = ["Single", "Married", "Common-Law", "Divorced", "Separated", "Widowed"];
const LANGUAGES = [
  "English", "Spanish", "French", "Portuguese", "Arabic",
  "Mandarin", "Cantonese", "Hindi", "Tagalog", "Vietnamese", "Korean", "Other",
];

const STEPS = [
  { id: 1, label: "About You",   icon: User  },
  { id: 2, label: "Identity",    icon: Globe },
  { id: 3, label: "Address",     icon: MapPin },
];

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
  phone: string;
  address: string;
};

const emptyForm: FormData = {
  firstName: "", lastName: "", prefix: "", middleName: "", dateOfBirth: "",
  maritalStatus: "", languagePreference: "", nationality: "", countryOfBirth: "",
  passportNumber: "", phone: "", address: "",
};

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function F({ label, id, hint, children }: {
  label: string; id: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

// ─── Step progress bar ────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done = step > s.id;
        const active = step === s.id;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${done ? "bg-blue-600 border-blue-600" : active ? "bg-white dark:bg-slate-900 border-blue-600" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"}`}>
                {done
                  ? <Check className="h-4 w-4 text-white" />
                  : <Icon className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-400"}`} />
                }
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? "text-blue-600" : done ? "text-slate-500" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-16 sm:w-24 mx-2 mb-5 rounded transition-all duration-300
                ${step > s.id ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export default function PortalOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState("");
  const [ready, setReady] = useState(false);

  // Check session + fetch existing profile data
  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.client) { router.replace(`/portal/${orgSlug}`); return; }
        if (data.profileCompleted) { router.replace(`/portal/${orgSlug}/dashboard`); return; }
        setClientEmail(data.client.email ?? "");
        setForm((f) => ({
          ...f,
          firstName: data.client.firstName ?? "",
          lastName: data.client.lastName ?? "",
          phone: data.client.phone ?? "",
        }));
        setReady(true);
      })
      .catch(() => router.replace(`/portal/${orgSlug}`));
  }, [orgSlug, router]);

  const set = (field: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleNext = () => {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSkip = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markComplete: true }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(`/portal/${orgSlug}/dashboard`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
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
      if (form.phone.trim()) body.phone = form.phone.trim();
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

      router.push(`/portal/${orgSlug}/dashboard`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-md mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {step === 1 ? `Hi ${form.firstName || "there"}, let's set up your profile` : "Complete your profile"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Step {step} of {STEPS.length} — takes about 2 minutes
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-5">

          {/* ── Step 1: About You ── */}
          {step === 1 && (
            <>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">About You</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Your personal information helps us serve you better.</p>
              </div>
              {/* Name + Email */}
              <div className="grid grid-cols-2 gap-3">
                <F label="First Name" id="firstName">
                  <Input id="firstName" value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    placeholder="First name" />
                </F>
                <F label="Last Name" id="lastName">
                  <Input id="lastName" value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    placeholder="Last name" />
                </F>
              </div>
              <F label="Email Address" id="email" hint="Email cannot be changed. Contact your attorney to update it.">
                <Input id="email" type="email" value={clientEmail} disabled
                  className="opacity-60 cursor-not-allowed" />
              </F>
              <div className="grid grid-cols-3 gap-3">
                <F label="Prefix" id="prefix">
                  <Select value={form.prefix} onValueChange={(v) => set("prefix", v === "none" ? "" : v)}>
                    <SelectTrigger id="prefix"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {PREFIXES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </F>
                <div className="col-span-2">
                  <F label="Middle Name" id="middleName">
                    <Input id="middleName" value={form.middleName}
                      onChange={(e) => set("middleName", e.target.value)}
                      placeholder="Optional" />
                  </F>
                </div>
              </div>
              <F label="Date of Birth" id="dateOfBirth">
                <Input id="dateOfBirth" type="date" value={form.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                  max={new Date().toISOString().split("T")[0]} />
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
              <F label="Preferred Language" id="languagePreference">
                <Select value={form.languagePreference} onValueChange={(v) => set("languagePreference", v === "none" ? "" : v)}>
                  <SelectTrigger id="languagePreference"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
            </>
          )}

          {/* ── Step 2: Identity ── */}
          {step === 2 && (
            <>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">Identity & Background</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Used for case preparation and government filings.</p>
              </div>
              <F label="Country of Citizenship" id="nationality"
                hint="The country that issued your passport or national ID.">
                <Input id="nationality" value={form.nationality}
                  onChange={(e) => set("nationality", e.target.value)}
                  placeholder="e.g., Mexico" />
              </F>
              <F label="Country of Birth" id="countryOfBirth">
                <Input id="countryOfBirth" value={form.countryOfBirth}
                  onChange={(e) => set("countryOfBirth", e.target.value)}
                  placeholder="e.g., Guatemala" />
              </F>
              <F label="Passport / National ID Number" id="passportNumber"
                hint="We keep this encrypted and use it only for your case.">
                <Input id="passportNumber" value={form.passportNumber}
                  onChange={(e) => set("passportNumber", e.target.value)}
                  placeholder="e.g., A12345678" />
              </F>
            </>
          )}

          {/* ── Step 3: Address & Contact ── */}
          {step === 3 && (
            <>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">Address & Contact</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Where we can reach you and send official correspondence.</p>
              </div>
              <F label="Primary Phone" id="phone">
                <Input id="phone" value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+1 555 0100" type="tel" />
              </F>
              <F label="Home Address" id="address"
                hint="Include street, city, state/province, zip code, and country.">
                <Textarea id="address" value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder={"123 Main St, Apt 4B\nLos Angeles, CA 90001\nUnited States"}
                  rows={4} className="resize-none" />
              </F>

              {/* Completion note */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Almost done!</strong> You can update any of these details later from your profile settings.
                </p>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">{error}</p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          {step > 1 ? (
            <Button variant="ghost" onClick={handleBack} className="gap-1.5 text-slate-600">
              <ChevronLeft className="h-4 w-4" />Back
            </Button>
          ) : (
            <div />
          )}

          {step < STEPS.length ? (
            <Button onClick={handleNext} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
              Next<ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 px-6">
              {submitting ? (
                <><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
              ) : (
                <><Check className="h-4 w-4" />Complete Profile</>
              )}
            </Button>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 mt-4">
          <p className="text-center text-xs text-slate-400">
            All fields are optional.
          </p>
          <button
            type="button"
            onClick={handleSkip}
            disabled={submitting}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            Skip for now — I&apos;ll complete this later
          </button>
        </div>
      </div>
    </div>
  );
}
