"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Building2, Globe } from "lucide-react";

// Phase 4: payment gateway configuration and bank accounts will be
// persisted via Convex backend with encrypted secret handling.

export default function PaymentSettingsPage() {
    const [stripeEnabled, setStripeEnabled] = useState(false);
    const [paypalEnabled, setPaypalEnabled] = useState(false);

    return (
        <div className="space-y-6">
            <PageHeader title="Payment Settings" description="Configure payment gateways and preferences" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stripe */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-violet-500" />
                                <CardTitle className="text-base">Stripe</CardTitle>
                            </div>
                            <Switch checked={stripeEnabled} onCheckedChange={setStripeEnabled} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Publishable Key</Label>
                            <Input placeholder="pk_live_..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>Secret Key</Label>
                            <Input type="password" placeholder="sk_live_..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>Webhook Secret</Label>
                            <Input type="password" placeholder="whsec_..." />
                        </div>
                        <Button size="sm">Save Stripe Settings</Button>
                    </CardContent>
                </Card>

                {/* PayPal */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Globe className="h-5 w-5 text-blue-500" />
                                <CardTitle className="text-base">PayPal</CardTitle>
                            </div>
                            <Switch checked={paypalEnabled} onCheckedChange={setPaypalEnabled} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Client ID</Label>
                            <Input placeholder="Your PayPal client ID" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Client Secret</Label>
                            <Input type="password" placeholder="Your PayPal client secret" />
                        </div>
                        <Button size="sm">Save PayPal Settings</Button>
                    </CardContent>
                </Card>
            </div>

            <Separator />

            {/* Linked Bank Accounts placeholder */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-5 w-5" /> Linked Bank Accounts
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground italic">
                        Bank accounts are managed in{" "}
                        <span className="font-medium">Settings → Bank Accounts</span>.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
