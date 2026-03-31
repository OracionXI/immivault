"use client";

import { useState, useCallback } from "react";
import { usePolling } from "@/hooks/use-polling";
import {
  Calendar, Video, Clock, ChevronLeft, ChevronRight,
  CheckCircle2, ArrowLeft, Loader2, FileText,
  X, RotateCcw, AlertTriangle, MapPin,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PortalAppointment = {
  _id: string;
  title: string;
  type: string;
  status: string;
  startAt: number;
  endAt: number;
  caseId?: string | null;
  assigneeName: string | null;
  googleMeetLink: string | null;
  notes: string | null;
  modality: "online" | "offline" | null;
};

type AppointmentPricing = {
  _id: string;
  appointmentType: string;
  priceInCents: number;
  currency: string;
  description?: string;
};

type BookingCase = {
  _id: string;
  title: string;
  caseNumber: string;
  assigneeName: string | null;
  assigneeGoogleConnected: boolean;
};

const BROWSER_TZ = typeof window !== "undefined"
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : "UTC";

// ─── Helpers ──────────────────────────────────────────────────────────────────


function formatDateTime(ts: number, timezone?: string) {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    year: "numeric", hour: "numeric", minute: "2-digit",
    timeZoneName: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function formatDuration(startAt: number, endAt: number) {
  const mins = Math.round((endAt - startAt) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`;
}

function formatSlotTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}


// ─── Status badge ─────────────────────────────────────────────────────────────

const statusStyle: Record<string, string> = {
  PendingApproval: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  Upcoming:  "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  Ongoing:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  Expired:   "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
  Cancelled: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
};

const statusLabel: Record<string, string> = {
  PendingApproval: "Pending Review",
};

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-1 flex-1">
          <div
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < current ? "bg-primary" : i === current ? "bg-primary/60" : "bg-muted"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Appointment card ─────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  muted,
  onCancel,
  onReschedule,
}: {
  appt: PortalAppointment;
  muted?: boolean;
  onCancel: (id: string) => void;
  onReschedule: (appt: PortalAppointment) => void;
}) {
  const isActionable = (appt.status === "Upcoming" || appt.status === "PendingApproval") && appt.startAt > Date.now();

  return (
    <div className={`rounded-xl border bg-card shadow-sm p-5 transition-shadow hover:shadow-md ${muted ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{appt.title}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle[appt.status] ?? "bg-slate-500/15 text-slate-600 border-slate-500/20"}`}>
              {statusLabel[appt.status] ?? appt.status}
            </span>
          </div>
          {appt.status === "PendingApproval" && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Waiting for confirmation from your case manager.
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDateTime(appt.startAt, BROWSER_TZ)}
            </span>
            <span>{formatDuration(appt.startAt, appt.endAt)}</span>
            {appt.assigneeName && <span>with {appt.assigneeName}</span>}
          </div>
          {appt.type && (
            <span className="inline-block mt-2 text-xs bg-accent text-muted-foreground px-2 py-0.5 rounded border border-border">
              {appt.type}
            </span>
          )}
          {appt.notes && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{appt.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {appt.modality === "offline" ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border rounded-lg px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5" />
              In-Person
            </span>
          ) : appt.googleMeetLink && appt.status === "Upcoming" ? (
            <a
              href={appt.googleMeetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Video className="h-3.5 w-3.5" />
              Join Meeting
            </a>
          ) : null}
          {isActionable && (
            <>
              <button
                onClick={() => onReschedule(appt)}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-lg px-3 py-1.5 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reschedule
              </button>
              <button
                onClick={() => onCancel(appt._id)}
                className="flex items-center gap-1.5 text-sm font-medium text-destructive hover:text-destructive/80 border border-destructive/30 hover:border-destructive/60 rounded-lg px-3 py-1.5 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cancel confirmation dialog ───────────────────────────────────────────────

function CancelDialog({
  open,
  onClose,
  onConfirm,
  confirming,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-2xl border shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
        <h3 className="font-semibold text-foreground text-lg">Cancel Appointment?</h3>
        <p className="text-sm text-muted-foreground">
          This will cancel your appointment. Please note that appointment fees are non-refundable.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="px-4 py-2 text-sm font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Yes, cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Booking wizard ───────────────────────────────────────────────────────────

type WizardStep = "type" | "modality" | "case" | "date" | "time" | "done";
type WizardMode = "book" | "reschedule";

function BookingWizard({
  pricing,
  onDone,
  rescheduleAppointment,
}: {
  pricing: AppointmentPricing[];
  onDone: () => void;
  rescheduleAppointment?: PortalAppointment | null;
}) {
  const isReschedule = !!rescheduleAppointment;

  // Pre-select pricing in reschedule mode
  const preselectPricing = isReschedule
    ? pricing.find((p) => p.appointmentType === rescheduleAppointment.type) ?? null
    : null;

  const [step, setStep] = useState<WizardStep>(isReschedule ? "date" : "modality");
  const [selectedPricing, setSelectedPricing] = useState<AppointmentPricing | null>(preselectPricing);
  const [selectedModality, setSelectedModality] = useState<"online" | "offline">("online");
  const [cases, setCases] = useState<BookingCase[] | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | "none" | null>(null);
  const [caseError, setCaseError] = useState<string | null>(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<{ year: number; month: number; day: number } | null>(null);

  const [slots, setSlots] = useState<number[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  const stepIndex: Record<WizardStep, number> = {
    modality: 0, type: 1, case: 2, date: 3, time: 4, done: 5,
  };
  const totalSteps = isReschedule ? 3 : 5;

  const handleSelectModality = (modality: "online" | "offline") => {
    setSelectedModality(modality);
    setSelectedPricing(null);
    setSelectedCaseId(null);
    setCaseError(null);
    setStep("type");
  };

  const handleSelectPricing = async (p: AppointmentPricing) => {
    setSelectedPricing(p);
    setSelectedCaseId(null);
    setCaseError(null);
    setCasesLoading(true);
    try {
      const res = await fetch("/api/portal/appointments/cases");
      const data = await res.json();
      setCases(data.error ? [] : (data.cases ?? []));
    } catch {
      setCases([]);
    } finally {
      setCasesLoading(false);
      setStep("case");
    }
  };

  const handleCaseNext = () => {
    if (selectedCaseId === null) { setCaseError("Please select an option."); return; }
    if (selectedCaseId !== "none" && selectedModality === "online") {
      const c = cases?.find((c) => c._id === selectedCaseId);
      if (c && !c.assigneeGoogleConnected) {
        setCaseError("Online meetings unavailable for this case. Please contact the office.");
        return;
      }
    }
    setCaseError(null);
    setSelectedDate(null);
    setStep("date");
  };

  const handleSelectDate = async (year: number, month: number, day: number) => {
    setSelectedDate({ year, month, day });
    setSlots([]);
    setSlotsError(null);
    setSlotsLoading(true);
    setSelectedSlot(null);

    // Determine which case manager's availability to check
    const caseId = isReschedule
      ? (rescheduleAppointment?.caseId ?? null)
      : (selectedCaseId !== "none" ? selectedCaseId : null);

    if (!caseId) {
      setSlotsError("Please link this appointment to a case to see available times.");
      setSlotsLoading(false);
      setStep("time");
      return;
    }

    try {
      // Send noon UTC as a safe proxy for "this calendar day" — the server resolves
      // the exact date using the staff member's timezone.
      const dateStartUTC = Date.UTC(year, month, day, 12, 0, 0);
      const qs = new URLSearchParams({ caseId, dateStartUTC: String(dateStartUTC) });
      const res = await fetch(`/api/portal/appointments/slots?${qs}`);
      const data = await res.json();
      if (data.error) setSlotsError(data.error);
      else if (data.noAssignee) setSlotsError("No case manager is assigned to this case yet. Please contact the office.");
      else setSlots(data.slots ?? []);
    } catch {
      setSlotsError("Failed to load available times.");
    } finally {
      setSlotsLoading(false);
      setStep("time");
    }
  };

  const handleBookSlot = async () => {
    if (!selectedSlot) return;
    const pricingToUse = selectedPricing ?? preselectPricing;
    if (!pricingToUse) return;

    setBooking(true);
    setBookError(null);

    if (isReschedule) {
      // Reschedule mode — always free (payment already captured)
      try {
        const res = await fetch("/api/portal/appointments/reschedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: rescheduleAppointment!._id,
            newStartAt: selectedSlot,
          }),
        });
        const data = await res.json();
        if (data.error) { setBookError(data.error); return; }
        setStep("done");
      } catch {
        setBookError("Something went wrong. Please try again.");
      } finally {
        setBooking(false);
      }
      return;
    }

    // Normal booking
    try {
      const res = await fetch("/api/portal/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentPricingId: pricingToUse._id,
          startAt: selectedSlot,
          caseId: selectedCaseId !== "none" ? selectedCaseId : undefined,
          modality: selectedModality,
        }),
      });
      const data = await res.json();
      if (data.error) { setBookError(data.error); return; }
      setStep("done");
    } catch {
      setBookError("Something went wrong. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  const maxDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const minDate = new Date(Date.now() + 60 * 60 * 1000);
  const isDateSelectable = (year: number, month: number, day: number) => {
    const d = new Date(year, month, day, 23, 59);
    const s = new Date(year, month, day, 0, 0);
    return s >= minDate && d <= maxDate;
  };
  const canGoNextMonth = () => new Date(calYear, calMonth + 1, 1) <= maxDate;
  const canGoPrevMonth = () => new Date(calYear, calMonth, 1) > new Date(today.getFullYear(), today.getMonth(), 1);
  const goNextMonth = () => { if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1); };
  const goPrevMonth = () => { if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1); };

  const goBack = () => {
    if (isReschedule) {
      if (step === "time") setStep("date");
      return;
    }
    if (step === "type") setStep("modality");
    else if (step === "case") setStep("type");
    else if (step === "date") setStep("case");
    else if (step === "time") setStep("date");
  };

  const currentStepIndex = isReschedule
    ? (step === "date" ? 0 : step === "time" ? 1 : 2)
    : stepIndex[step];

  if (step === "done") {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-sm p-10 text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {isReschedule ? "Reschedule Request Sent!" : "Request Submitted!"}
        </h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          {isReschedule
            ? "Your reschedule request has been submitted. Your case manager will confirm the new time shortly."
            : "Your appointment request has been received. Your case manager will confirm the time shortly."}
        </p>
        {selectedSlot && (
          <p className="text-sm font-medium text-foreground">
            {formatDateTime(selectedSlot, BROWSER_TZ)} · 1 hour
          </p>
        )}
        <button
          onClick={onDone}
          className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to appointments
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3 mb-1">
          {step !== "modality" && (
            <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="font-semibold text-foreground">
            {isReschedule && step === "date" && "Choose a New Date"}
            {isReschedule && step === "time" && "Select a New Time"}
            {!isReschedule && step === "modality" && "Book an Appointment"}
            {!isReschedule && step === "type" && "Choose Appointment Type"}
            {!isReschedule && step === "case" && "Link to a Case"}
            {!isReschedule && step === "date" && "Choose a Date"}
            {!isReschedule && step === "time" && "Select a Time"}
          </h2>
        </div>
        <StepBar current={currentStepIndex} total={totalSteps} />
      </div>

      <div className="p-6">
        {/* ── Step 1: Modality Selection ── */}
        {step === "modality" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              How would you like to meet with your case manager?
            </p>
            <button
              onClick={() => handleSelectModality("online")}
              className="w-full text-left p-5 rounded-xl border border-border hover:border-primary/50 hover:bg-accent transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">Online Meeting</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Video call via Google Meet — join from anywhere</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => handleSelectModality("offline")}
              className="w-full text-left p-5 rounded-xl border border-border hover:border-primary/50 hover:bg-accent transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-muted/80 transition-colors">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">In-Person</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Visit the office in person</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ── Step 2: Type Selection ── */}
        {step === "type" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Select the type of appointment you&apos;d like to schedule.
            </p>
            {pricing.map((p) => (
              <button
                key={p._id}
                onClick={() => handleSelectPricing(p)}
                className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-accent transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{p.appointmentType}</p>
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0 ml-4">1 hour</p>
                </div>
              </button>
            ))}
            {casesLoading && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading…</span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Case Selection ── */}
        {step === "case" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Is this appointment related to one of your active cases?</p>
            {casesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {cases && cases.length > 0 && cases.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { setSelectedCaseId(c._id); setCaseError(null); }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedCaseId === c._id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">{c.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">#{c.caseNumber}{c.assigneeName && ` · Managed by ${c.assigneeName}`}</p>
                        {!c.assigneeGoogleConnected && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Online meetings unavailable for this case</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => { setSelectedCaseId("none"); setCaseError(null); }}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedCaseId === "none" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40 hover:bg-accent"
                  }`}
                >
                  <p className="font-medium text-foreground text-sm">Not related to a case</p>
                  <p className="text-xs text-muted-foreground mt-0.5">General consultation or enquiry</p>
                </button>
              </>
            )}
            {caseError && <p className="text-sm text-red-600 dark:text-red-400">{caseError}</p>}
            <button
              onClick={handleCaseNext}
              disabled={selectedCaseId === null}
              className="w-full mt-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 3: Calendar ── */}
        {step === "date" && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {isReschedule ? "Select a new date — up to 60 days ahead." : "Select a date — up to 60 days ahead."} Times are shown in your local timezone.
            </p>
            <div className="flex items-center justify-between mb-4">
              <button onClick={goPrevMonth} disabled={!canGoPrevMonth()} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold text-sm text-foreground">{formatMonthYear(calYear, calMonth)}</span>
              <button onClick={goNextMonth} disabled={!canGoNextMonth()} className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: getFirstDayOfWeek(calYear, calMonth) }, (_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: getDaysInMonth(calYear, calMonth) }, (_, i) => {
                const day = i + 1;
                const selectable = isDateSelectable(calYear, calMonth, day);
                const isSelected = selectedDate?.year === calYear && selectedDate?.month === calMonth && selectedDate?.day === day;
                return (
                  <button
                    key={day}
                    onClick={() => selectable && handleSelectDate(calYear, calMonth, day)}
                    disabled={!selectable}
                    className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                      isSelected ? "bg-primary text-primary-foreground shadow-sm"
                        : selectable ? "hover:bg-primary/10 hover:text-primary text-foreground"
                        : "text-muted-foreground/30 cursor-not-allowed"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {slotsLoading && (
              <div className="flex items-center justify-center gap-2 py-4 mt-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading times…</span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Time Slots ── */}
        {step === "time" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {selectedDate
                  ? new Date(selectedDate.year, selectedDate.month, selectedDate.day)
                      .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                  : ""}
              </span>
            </div>
            {slotsLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            {slotsError && <p className="text-sm text-red-600 dark:text-red-400">{slotsError}</p>}
            {!slotsLoading && !slotsError && slots.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm font-medium text-foreground">No available times on this day</p>
                <p className="text-xs text-muted-foreground">Please go back and choose a different date.</p>
              </div>
            )}
            {!slotsLoading && slots.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
                        selectedSlot === slot ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border hover:border-primary/50 hover:bg-accent text-foreground"
                      }`}
                    >
                      {formatSlotTime(slot)}
                    </button>
                  ))}
                </div>
                {bookError && <p className="text-sm text-red-600 dark:text-red-400">{bookError}</p>}
                {selectedSlot && (
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">
                        {formatSlotTime(selectedSlot)} – {formatSlotTime(selectedSlot + 3600_000)} · 1 hour
                      </span>
                    </div>
                    <button
                      onClick={handleBookSlot}
                      disabled={booking}
                      className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {booking && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isReschedule ? "Submit Reschedule Request" : "Confirm Booking"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortalAppointmentsPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<PortalAppointment | null>(null);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);
  const [pricing, setPricing] = useState<AppointmentPricing[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    fetch("/api/portal/appointments")
      .then((r) => r.json())
      .then((data) => {
        if (data.appointments) setAppointments(data.appointments);
        if (data.pricing) setPricing(data.pricing);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  usePolling(loadData, 15_000);

  const handleWizardDone = () => {
    setShowWizard(false);
    setRescheduleTarget(null);
    loadData();
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/portal/appointments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: cancelTarget }),
      });
      const data = await res.json();
      if (data.error) { setCancelError(data.error); return; }
      setCancelTarget(null);
      loadData();
    } catch {
      setCancelError("Failed to cancel. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = (appt: PortalAppointment) => {
    setRescheduleTarget(appt);
    setShowWizard(true);
  };

  // All future appointments (pending + confirmed), sorted soonest first, minimum 3 shown
  const upcomingAll = appointments
    .filter((a) => (a.status === "PendingApproval" || a.status === "Upcoming") && a.startAt > Date.now())
    .sort((a, b) => a.startAt - b.startAt);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const visibleUpcoming = showAllUpcoming ? upcomingAll : upcomingAll.slice(0, 3);

  const past = appointments
    .filter((a) => a.status !== "PendingApproval" && (a.status !== "Upcoming" || a.startAt <= Date.now()))
    .sort((a, b) => b.startAt - a.startAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Appointments</h1>
        <p className="text-sm text-muted-foreground mt-1">Your scheduled meetings and consultations.</p>
      </div>

      {showWizard && (
        <BookingWizard
          pricing={pricing}
          onDone={handleWizardDone}
          rescheduleAppointment={rescheduleTarget}
        />
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && appointments.length === 0 && !showWizard && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-16 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground">No appointments yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {pricing.length > 0 ? "Book your first appointment below." : "Appointment booking will be available soon."}
          </p>
          {pricing.length > 0 && (
            <button
              onClick={() => setShowWizard(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Book your first appointment
            </button>
          )}
        </div>
      )}

      {!loading && (upcomingAll.length > 0 || appointments.length > 0) && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h2 className="font-semibold text-foreground">Upcoming Appointments</h2>
              {upcomingAll.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {upcomingAll.length} {upcomingAll.length === 1 ? "appointment" : "appointments"} scheduled
                </p>
              )}
            </div>
            {pricing.length > 0 && !showWizard && (
              <button
                onClick={() => { setRescheduleTarget(null); setShowWizard(true); }}
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                + Book New
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            {upcomingAll.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
                {pricing.length > 0 && (
                  <button
                    onClick={() => setShowWizard(true)}
                    className="mt-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Book your first appointment
                  </button>
                )}
              </div>
            ) : (
              <>
                {visibleUpcoming.map((a) => (
                  <AppointmentCard
                    key={a._id} appt={a}
                    onCancel={setCancelTarget} onReschedule={handleReschedule}
                  />
                ))}
                {upcomingAll.length > 3 && (
                  <button
                    onClick={() => setShowAllUpcoming((v) => !v)}
                    className="w-full text-sm text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                  >
                    {showAllUpcoming ? "Show less" : `Show ${upcomingAll.length - 3} more`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!loading && past.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">Past</h2>
          <div className="space-y-3">
            {past.map((a) => (
              <AppointmentCard
                key={a._id} appt={a} muted
                onCancel={setCancelTarget} onReschedule={handleReschedule}
              />
            ))}
          </div>
        </div>
      )}

      <CancelDialog
        open={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelError(null); }}
        onConfirm={handleCancelConfirm}
        confirming={cancelling}
      />
      {cancelError && (
        <div className="fixed bottom-4 right-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-700 dark:text-red-400 text-sm shadow-lg">
          {cancelError}
        </div>
      )}
    </div>
  );
}
