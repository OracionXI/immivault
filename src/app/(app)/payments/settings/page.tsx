"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { mockBankAccounts } from "@/lib/mock-data";
import { CreditCard, Building2, Shield, Globe } from "lucide-react";

export default function PaymentSettingsPage() {
    const [stripeEnabled, setStripeEnabled] = useState(true);
    const [paypalEnabled, setPaypalEnabled] = useState(false);

    return (
        <div className="space-y-6">
            <PageHeader title="Payment Settings" description="Configure payment gateways and preferences" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stripe */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-violet-500" /><CardTitle className="text-base">Stripe</CardTitle></div>
                            <Switch checked={stripeEnabled} onCheckedChange={setStripeEnabled} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2"><Label>Publishable Key</Label><Input placeholder="pk_live_..." defaultValue="pk_live_****" /></div>
                        <div className="grid gap-2"><Label>Secret Key</Label><Input type="password" placeholder="sk_live_..." defaultValue="sk_live_****" /></div>
                        <div className="grid gap-2"><Label>Webhook Secret</Label><Input type="password" placeholder="whsec_..." defaultValue="whsec_****" /></div>
                        <Button size="sm">Save Stripe Settings</Button>
                    </CardContent>
                </Card>

                {/* PayPal */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-blue-500" /><CardTitle className="text-base">PayPal</CardTitle></div>
                            <Switch checked={paypalEnabled} onCheckedChange={setPaypalEnabled} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2"><Label>Client ID</Label><Input placeholder="Your PayPal client ID" /></div>
                        <div className="grid gap-2"><Label>Client Secret</Label><Input type="password" placeholder="Your PayPal client secret" /></div>
                        <Button size="sm">Save PayPal Settings</Button>
                    </CardContent>
                </Card>
            </div>

            <Separator />

            {/* Linked Bank Accounts */}
            <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-5 w-5" /> Linked Bank Accounts</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {mockBankAccounts.map((ba) => (
                            <div key={ba.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                                <div>
                                    <p className="font-medium text-sm">{ba.bankName} – {ba.accountName}</p>
                                    <p className="text-xs text-muted-foreground">Account: {ba.accountNumber} · Routing: {ba.routingNumber}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {ba.isDefault && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Default</span>}
                                    <Shield className="h-4 w-4 text-emerald-500" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
