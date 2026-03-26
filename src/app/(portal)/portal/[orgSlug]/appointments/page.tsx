"use client";

import { useState, useEffect } from "react";
import { Calendar, Video, Clock, Plus, X } from "lucide-react";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

type PortalAppointment = {
  _id: string;
  title: string;
  type: string;
  status: string;
  startAt: number;
  endAt: number;
  assigneeName: string | null;
  googleMeetLink: string | null;
  notes: string | null;
};

type AppointmentPricing = {
  _id: string;
  appointmentType: string;
  priceInCents: number;
  currency: string;
  description?: string;
};

const statusStyle: Record<string, string> = {
  Upcoming:  "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  Ongoing:   "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  Expired:   "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
  Cancelled: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
};

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function formatDuration(startAt: number, endAt: number) {
  const mins = Math.round((endAt - startAt) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.round(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`;
}

export default function PortalAppointmentsPage() {
  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);
  const [pricing, setPricing] = useState<AppointmentPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/appointments").then((r) => r.json()),
      fetch("/api/portal/appointment-pricing").then((r) => r.json()),
    ])
      .then(([apptData, pricingData]) => {
        if (apptData.error) setError(apptData.error);
        else setAppointments(apptData.appointments ?? []);
        if (!pricingData.error) setPricing(pricingData.pricing ?? []);
      })
      .catch(() => setError("Failed to load appointments."))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = appointments.filter((a) => a.status === "Upcoming" && a.startAt > Date.now());
  const past = appointments.filter((a) => a.status !== "Upcoming" || a.startAt <= Date.now());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">Your scheduled meetings and consultations.</p>
        </div>
        {!loading && pricing.length > 0 && !showBooking && (
          <button
            onClick={() => setShowBooking(true)}
            className="flex items-center gap-1.5 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Book Appointment
          </button>
        )}
      </div>

      {showBooking && (
        <BookingPanel pricing={pricing} onClose={() => setShowBooking(false)} />
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && appointments.length === 0 && !showBooking && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-16 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-foreground">No appointments</p>
          <p className="text-sm text-muted-foreground mt-1 italic">Your appointments will appear here when scheduled.</p>
          {pricing.length > 0 && (
            <button
              onClick={() => setShowBooking(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Book your first appointment
            </button>
          )}
        </div>
      )}

      {!loading && upcoming.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map((a) => <AppointmentCard key={a._id} appt={a} />)}
          </div>
        </div>
      )}

      {!loading && past.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1 mt-2">Past</h2>
          <div className="space-y-3">
            {past.map((a) => <AppointmentCard key={a._id} appt={a} muted />)}
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentCard({ appt, muted }: { appt: PortalAppointment; muted?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card shadow-sm p-5 transition-shadow hover:shadow-md ${muted ? "border-border opacity-60" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{appt.title}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle[appt.status] ?? "bg-slate-500/15 text-slate-600 border-slate-500/20"}`}>
              {appt.status}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDateTime(appt.startAt)}
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
        {appt.googleMeetLink && appt.status === "Upcoming" && (
          <a
            href={appt.googleMeetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 rounded-lg px-3 py-1.5 transition-colors shrink-0"
          >
            <Video className="h-3.5 w-3.5" />
            Join Meeting
          </a>
        )}
      </div>
    </div>
  );
}

function BookingPanel({ pricing, onClose }: { pricing: AppointmentPricing[]; onClose: () => void }) {
  const [selectedPricing, setSelectedPricing] = useState<AppointmentPricing | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("09:00");
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const handleBook = async () => {
    if (!selectedPricing || !dateInput) {
      setBookingError("Please select an appointment type and date.");
      return;
    }
    const startAt = new Date(`${dateInput}T${timeInput}`).getTime();
    if (isNaN(startAt) || startAt < Date.now()) {
      setBookingError("Please select a future date and time.");
      return;
    }
    setBookingError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentPricingId: selectedPricing._id, startAt, durationMinutes: 60 }),
      });
      const data = await res.json();
      if (data.error) { setBookingError(data.error); return; }
      if (data.urlToken) window.location.href = `/pay/${data.urlToken}`;
    } catch {
      setBookingError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Book an Appointment</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Select a type and preferred time</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Appointment type</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {pricing.map((p) => (
            <button
              key={p._id}
              onClick={() => setSelectedPricing(p)}
              className={`text-left p-3.5 rounded-lg border transition-all ${
                selectedPricing?._id === p._id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-accent"
              }`}
            >
              <p className="font-medium text-foreground text-sm">{p.appointmentType}</p>
              <p className="text-sm text-primary font-semibold mt-0.5">{formatPrice(p.priceInCents, p.currency)}</p>
              {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Preferred Date</label>
          <input
            type="date" min={minDate} value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Preferred Time</label>
          <input
            type="time" value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {bookingError && (
        <p className="text-sm text-red-600 dark:text-red-400">{bookingError}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleBook}
          disabled={submitting || !selectedPricing || !dateInput}
          className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2.5 rounded-lg transition-colors shadow-sm"
        >
          {submitting
            ? "Processing…"
            : selectedPricing
            ? `Proceed to Payment — ${formatPrice(selectedPricing.priceInCents, selectedPricing.currency)}`
            : "Select appointment type"}
        </button>
        <button
          onClick={onClose}
          className="px-4 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Your attorney will confirm the exact time. You&apos;ll be charged now and notified once the appointment is confirmed.
      </p>
    </div>
  );
}
