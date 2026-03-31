"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Image from "next/image";

type Step = "email" | "otp";

export default function PortalLoginPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = params.orgSlug as string;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  // Check if already logged in
  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.client) router.replace(`/portal/${orgSlug}/dashboard`);
      })
      .catch(() => {});
  }, [orgSlug, router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/portal/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), orgSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send code. Please try again.");
      } else {
        setStep("otp");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/portal/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), orgSlug, code: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid or expired code.");
      } else {
        router.push(`/portal/${orgSlug}/dashboard`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <Image src="/ordena_logo.png" alt="Ordena" width={48} height={48} className="rounded-xl" />
            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Client Portal</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {step === "email"
                  ? "Enter your email to receive a login code"
                  : `We sent a 6-digit code to ${email}`}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  className="bg-white dark:bg-slate-800"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Login Code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">6-Digit Code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                  autoFocus
                  className="text-center text-2xl tracking-widest font-mono bg-white dark:bg-slate-800"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Code expires in 10 minutes</p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || otp.length !== 6}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Verify & Sign In
              </Button>
              <button
                type="button"
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
                onClick={() => { setStep("email"); setOtp(""); setError(null); }}
              >
                Use a different email
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-slate-400">
            Secure portal powered by Ordena
          </p>
        </div>
      </div>
    </div>
  );
}
