"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { RoleGuard } from "@/components/shared/role-guard";
import { PageHeader } from "@/components/shared/page-header";

export default function PortalSettingsPage() {
  const portalSettings = useQuery(api.organisations.queries.getPortalSettings);
  const updatePortal = useMutation(api.organisations.mutations.updatePortalSettings);

  const [slug, setSlug] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (portalSettings) {
      setSlug(portalSettings.portalSlug ?? "");
      setEnabled(portalSettings.portalEnabled ?? false);
    }
  }, [portalSettings]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  const portalUrl = slug ? `${appUrl}/portal/${slug}` : null;

  const handleSave = async () => {
    if (!slug.trim()) {
      toast.error("Portal slug is required.");
      return;
    }
    setSaving(true);
    try {
      await updatePortal({ portalSlug: slug.trim(), portalEnabled: enabled });
      toast.success("Portal settings saved.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <RoleGuard allowedRoles={["admin"]} redirectTo="/settings">
      <div className="space-y-6">
        <PageHeader
          title="Client Portal"
          description="Configure the self-service portal where clients can view their cases, invoices, and appointments."
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Portal Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Enable Client Portal</Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  When enabled, clients with portal access can sign in using their email.
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">Portal Slug</Label>
              <p className="text-sm text-muted-foreground">
                The unique URL path for your firm's portal. Use letters, numbers, and hyphens only.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center border rounded-md overflow-hidden">
                  <span className="px-3 py-2 text-sm text-muted-foreground bg-muted border-r shrink-0">
                    {appUrl}/portal/
                  </span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="smith-law-firm"
                    className="border-0 rounded-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>

            {/* Portal URL preview */}
            {portalUrl && (
              <div className="rounded-lg bg-muted p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {enabled ? (
                    <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200 shrink-0">Live</Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">Disabled</Badge>
                  )}
                  <span className="text-sm font-mono truncate text-muted-foreground">{portalUrl}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyUrl}>
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  {enabled && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving || !slug.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Portal Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>• When a client is added, you can enable portal access on their profile.</p>
            <p>• Clients receive an invite email with a one-time magic link to set up their access.</p>
            <p>• Clients can then log in any time using their email and a 6-digit code.</p>
            <p>• The portal shows their cases, invoices (with pay buttons), appointments, and payment history.</p>
            <p>• All portal access is scoped to the individual client — they only see their own data.</p>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
