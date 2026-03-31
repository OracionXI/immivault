"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, CheckCircle2, ChevronLeft, AlertCircle, Clock, User, CalendarDays, Video, MapPin, ShieldCheck, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConsultationPricing = { priceInCents: number; currency: string } | null;
type OrgInfo = { orgName: string; consultationPricing: ConsultationPricing };

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  appointmentType: string;
  preferredDate: string;
  preferredTime: string;      // local HH:MM for display only
  preferredSlotUTC: number | null; // authoritative UTC epoch for appointment creation
  clientTimezone: string;
  meetingMode: "online" | "in_person";
  message: string;
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Your details", "Appointment", "Done"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="relative mb-8 mt-2 w-full">
      {/* Background Line */}
      <div className="absolute top-[17px] left-[16.666%] right-[16.666%] h-[2px] bg-slate-200/80 rounded-full" />
      {/* Progress Line */}
      <div
        className="absolute top-[17px] left-[16.666%] h-[2px] bg-emerald-400 rounded-full transition-all duration-700"
        style={{ width: `${(Math.min(current - 1, 2) / 2) * 66.666}%` }}
      />

      <div className="grid grid-cols-3">
        {STEPS.map((label, i) => {
          const num = i + 1;
          const done = current > num;
          const active = current === num;
          return (
            <div key={num} className="flex flex-col items-center gap-2 relative z-10">
              <div className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ring-4",
                done
                  ? "bg-emerald-500 text-white ring-emerald-50"
                  : active
                    ? "bg-blue-600 text-white ring-blue-50 shadow-lg shadow-blue-600/30"
                    : "bg-white text-slate-400 ring-slate-50 border border-slate-200"
              )}>
                {done ? <CheckCircle2 className="h-4.5 w-4.5" /> : num}
              </div>
              <span className={cn(
                "text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-center transition-colors w-full px-1",
                active ? "text-blue-600" : done ? "text-emerald-600" : "text-slate-400"
              )}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppointmentRequestPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", email: "", phone: "",
    appointmentType: "Consultation", preferredDate: "", preferredTime: "",
    preferredSlotUTC: null,
    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    meetingMode: "online",
    message: "",
  });

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => {
    fetch(`/api/portal/${orgSlug}/public-info`)
      .then((r) => r.json())
      .then((data: { orgName?: string; error?: string; consultationPricing?: ConsultationPricing }) => {
        if (data.error) { setLoadError(data.error); return; }
        setOrgInfo({ orgName: data.orgName!, consultationPricing: data.consultationPricing ?? null });
      })
      .catch(() => setLoadError("Could not load page. Please try again later."));
  }, [orgSlug]);

  // ── Availability slots ────────────────────────────────────────────────────
  const [slots, setSlots] = useState<number[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const fetchSlots = useCallback(async (dateStr: string) => {
    if (!dateStr) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSlots([]);
    setForm((f) => ({ ...f, preferredTime: "" }));
    try {
      const res = await fetch(`/api/portal/${orgSlug}/public-admin-slots?dateStr=${encodeURIComponent(dateStr)}`);
      const data = await res.json() as { slots?: number[]; error?: string };
      if (data.error) { setSlotsError("Could not load available times."); return; }
      setSlots(data.slots ?? []);
      if ((data.slots ?? []).length === 0) setSlotsError("No availability on this day. Please choose another date.");
    } catch {
      setSlotsError("Could not load available times.");
    } finally {
      setSlotsLoading(false);
    }
  }, [orgSlug]);

  const handleDateChange = (dateStr: string) => {
    setForm((f) => ({ ...f, preferredDate: dateStr, preferredTime: "", preferredSlotUTC: null }));
    if (dateStr) fetchSlots(dateStr);
    else { setSlots([]); setSlotsError(null); }
  };

  const handleSlotSelect = (slotUTC: number) => {
    // Store the UTC timestamp as the authoritative time; derive local HH:MM for display only
    const d = new Date(slotUTC);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    setForm((f) => ({ ...f, preferredTime: `${hh}:${mm}`, preferredSlotUTC: slotUTC }));
  };

  function formatSlotLabel(slotUTC: number) {
    return new Date(slotUTC).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  // A slot is selected when we have its UTC value stored
  const selectedSlotUTC = form.preferredSlotUTC;

  const step1Valid = form.firstName.trim() && form.lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.phone.trim();
  const step2Valid = form.preferredDate && form.preferredTime;

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const { preferredSlotUTC: _slotUTC, ...formFields } = form;
      const res = await fetch(`/api/portal/${orgSlug}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formFields, preferredSlotUTC: form.preferredSlotUTC ?? undefined }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStep(3);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [form, orgSlug]);

  const todayStr = new Date().toISOString().split("T")[0];

  // ── Loading ────────────────────────────────────────────────────────────────

  if (!orgInfo && !loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-[3px] border-blue-600/30 border-t-blue-600 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)" }}>
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Page not available</h1>
            <p className="text-sm text-slate-500 mt-1">{loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────

  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)" }}>
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
            {/* Top accent */}
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500" />
            <div className="px-8 py-10 text-center">
              {/* Icon */}
              <div className="mx-auto mb-6 relative w-fit">
                <div className="h-20 w-20 rounded-3xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-yellow-400 flex items-center justify-center shadow-md">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">You&apos;re all set!</h1>
              <p className="text-slate-500 mt-2 leading-relaxed text-sm">
                Thank you, <span className="font-semibold text-slate-700">{form.firstName}</span>. Your consultation request has been submitted to{" "}
                <span className="font-semibold text-slate-700">{orgInfo!.orgName}</span>.
              </p>

              {/* Summary card */}
              <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 px-5 py-4 text-left space-y-2.5">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-slate-600">
                    <span className="font-medium text-slate-800">
                      {form.preferredSlotUTC
                        ? new Date(form.preferredSlotUTC).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
                        : form.preferredDate}
                    </span>
                    {" at "}
                    <span className="font-medium text-slate-800">
                      {form.preferredSlotUTC
                        ? new Date(form.preferredSlotUTC).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                        : form.preferredTime}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {form.meetingMode === "online"
                    ? <Video className="h-4 w-4 text-blue-500 shrink-0" />
                    : <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
                  }
                  <span className="text-sm text-slate-600">
                    {form.meetingMode === "online" ? "Online — meeting link will be sent on confirmation" : "In-person — team will share location details"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-5">
                Confirmation will be sent to <span className="font-semibold text-slate-500">{form.email}</span>
              </p>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-5 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure &amp; confidential
          </p>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)" }}>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100/80 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm shadow-md"
              style={{ background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)", color: "#fff" }}
            >
              {orgInfo!.orgName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-none">{orgInfo!.orgName}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-medium">Appointment Request</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Secure & Confidential
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-xl mx-auto w-full px-5 pt-10 pb-2 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          {orgInfo!.consultationPricing && orgInfo!.consultationPricing.priceInCents > 0
            ? "Book a Consultation"
            : "Free Consultation — No commitment required"}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
          Book your consultation with{" "}
          <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            {orgInfo!.orgName}
          </span>
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          Complete the form below and our team will confirm your appointment within 24 hours.
        </p>
      </div>

      {/* Form area */}
      <main className="flex-1 flex items-start justify-center px-4 pt-6 pb-12">
        <div className="w-full max-w-xl">

          <StepBar current={step} />

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">

            {/* Step 1: Personal info */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="px-7 pt-7 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-800">Your information</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Used to confirm and contact you about your appointment</p>
                    </div>
                  </div>
                </div>
                <div className="px-7 py-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-[13px] font-medium text-slate-700">First name <span className="text-blue-500">*</span></Label>
                      <Input
                        id="firstName"
                        value={form.firstName}
                        onChange={set("firstName")}
                        placeholder="Jane"
                        autoFocus
                        className="h-12 border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 rounded-xl text-slate-900 placeholder:text-slate-400 shadow-sm transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-[13px] font-medium text-slate-700">Last name <span className="text-blue-500">*</span></Label>
                      <Input
                        id="lastName"
                        value={form.lastName}
                        onChange={set("lastName")}
                        placeholder="Smith"
                        className="h-12 border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 rounded-xl text-slate-900 placeholder:text-slate-400 shadow-sm transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[13px] font-medium text-slate-700">Email address <span className="text-blue-500">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="jane@example.com"
                      className="h-12 border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 rounded-xl text-slate-900 placeholder:text-slate-400 shadow-sm transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-[13px] font-medium text-slate-700">
                      Phone number <span className="text-blue-500">*</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={set("phone")}
                      placeholder="+1 555 000 0000"
                      className="h-12 border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 rounded-xl text-slate-900 placeholder:text-slate-400 shadow-sm transition-all"
                    />
                  </div>
                </div>
                <div className="px-7 pb-7">
                  <Button
                    className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-blue-600/20"
                    style={{ background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)", color: "#ffffff" }}
                    disabled={!step1Valid}
                    onClick={() => setStep(2)}
                  >
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Appointment details */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="px-7 pt-7 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-violet-50 flex items-center justify-center">
                      <CalendarDays className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-800">Appointment details</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Tell us your preferred date, time, and how you&apos;d like to meet</p>
                    </div>
                  </div>
                </div>

                <div className="px-7 py-6 space-y-6">

                  {/* Pricing info — only shown for online appointments with a fee set */}
                  {form.meetingMode === "online" && orgInfo!.consultationPricing && orgInfo!.consultationPricing.priceInCents > 0 && (
                    <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                      <span className="text-lg mt-0.5">💳</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">
                          Consultation fee:{" "}
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: orgInfo!.consultationPricing.currency,
                          }).format(orgInfo!.consultationPricing.priceInCents / 100)}
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          A secure payment link will be sent to your email after confirmation.
                          Your appointment is activated once payment is received.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Meeting mode */}
                  <div className="space-y-3">
                    <Label className="text-[13px] font-medium text-slate-700">
                      Meeting type <span className="text-blue-500">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        {
                          mode: "online" as const,
                          icon: Video,
                          title: "Online",
                          desc: "Join via video — link sent on confirmation",
                          color: "blue",
                        },
                        {
                          mode: "in_person" as const,
                          icon: MapPin,
                          title: "In-person",
                          desc: "Visit the office — team shares location",
                          color: "violet",
                        },
                      ]).map(({ mode, icon: Icon, title, desc, color }) => {
                        const active = form.meetingMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, meetingMode: mode }))}
                            className={cn(
                              "relative flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all duration-200",
                              active
                                ? color === "blue"
                                  ? "border-blue-400 bg-blue-50/60 shadow-sm shadow-blue-100"
                                  : "border-violet-400 bg-violet-50/60 shadow-sm shadow-violet-100"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                            )}
                          >
                            <div className={cn(
                              "h-8 w-8 rounded-xl flex items-center justify-center transition-colors",
                              active
                                ? color === "blue" ? "bg-blue-100" : "bg-violet-100"
                                : "bg-slate-100"
                            )}>
                              <Icon className={cn(
                                "h-4 w-4 transition-colors",
                                active
                                  ? color === "blue" ? "text-blue-600" : "text-violet-600"
                                  : "text-slate-400"
                              )} />
                            </div>
                            <div>
                              <p className={cn(
                                "text-sm font-semibold leading-none transition-colors",
                                active ? (color === "blue" ? "text-blue-700" : "text-violet-700") : "text-slate-700"
                              )}>{title}</p>
                              <p className="text-[11px] text-slate-400 mt-1 leading-tight">{desc}</p>
                            </div>
                            {active && (
                              <div className={cn(
                                "absolute top-3 right-3 h-4 w-4 rounded-full flex items-center justify-center",
                                color === "blue" ? "bg-blue-500" : "bg-violet-500"
                              )}>
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date picker */}
                  <div className="space-y-1.5">
                    <Label htmlFor="preferredDate" className="text-[13px] font-medium text-slate-700">
                      Preferred date <span className="text-blue-500">*</span>
                    </Label>
                    <Input
                      id="preferredDate"
                      type="date"
                      min={todayStr}
                      value={form.preferredDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="h-9 w-full border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 rounded-xl text-slate-900 shadow-sm transition-all"
                      style={{ colorScheme: "light" }}
                    />
                  </div>

                  {/* Time slot picker */}
                  {form.preferredDate && (
                    <div className="space-y-2">
                      <Label className="text-[13px] font-medium text-slate-700">
                        Available times <span className="text-blue-500">*</span>
                      </Label>
                      {slotsLoading && (
                        <div className="flex items-center gap-2 py-3 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading available times…
                        </div>
                      )}
                      {!slotsLoading && slotsError && (
                        <p className="text-sm text-amber-600">{slotsError}</p>
                      )}
                      {!slotsLoading && !slotsError && slots.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {slots.map((slot) => {
                            const isSelected = selectedSlotUTC === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => handleSlotSelect(slot)}
                                className={cn(
                                  "py-2 px-2 rounded-xl text-sm font-medium border transition-all",
                                  isSelected
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                    : "border-slate-200 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/50 text-slate-700"
                                )}
                              >
                                <Clock className="h-3 w-3 mx-auto mb-0.5 opacity-60" />
                                {formatSlotLabel(slot)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message */}
                  <div className="space-y-1.5">
                    <Label htmlFor="message" className="text-[13px] font-medium text-slate-700">
                      Brief message <span className="text-slate-400 font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={set("message")}
                      placeholder="Share any context that would help us prepare for your consultation…"
                      rows={4}
                      className="resize-none p-3 border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 rounded-xl text-slate-900 placeholder:text-slate-400 shadow-sm transition-all"
                    />
                  </div>

                  {submitError && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {submitError}
                    </div>
                  )}
                </div>

                <div className="px-7 pb-7 flex gap-3">
                  <Button
                    variant="outline"
                    className="h-12 border-slate-200 text-slate-600 rounded-xl hover:border-slate-300"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                  <Button
                    className="flex-1 h-12 text-base font-semibold rounded-xl shadow-lg shadow-blue-600/20"
                    style={{ background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)", color: "#ffffff" }}
                    disabled={!step2Valid || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Submitting…
                      </span>
                    ) : (
                      <>
                        Submit request
                        <Calendar className="ml-2 h-4 w-4 text-white" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

          </div>

          {/* Footer trust + sign-in */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Secure & confidential</span>
              <span className="w-px h-3 bg-slate-200" />
              <span>No commitment required</span>
            </div>
            <p className="text-xs text-slate-400">
              Already have an account?{" "}
              <button
                className="font-semibold text-blue-600 hover:text-blue-700 transition-colors underline underline-offset-2"
                onClick={() => router.push(`/portal/${orgSlug}`)}
              >
                Sign in to your portal
              </button>
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
