"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save, Loader2, Camera, CheckCircle2, Unlink } from "lucide-react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

/** Converts a crop area into a circular Blob via an offscreen canvas. */
async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img));
        img.addEventListener("error", reject);
        img.src = imageSrc;
    });
    const canvas = document.createElement("canvas");
    const size = Math.min(cropArea.width, cropArea.height);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // Circular clip
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
        image,
        cropArea.x, cropArea.y, cropArea.width, cropArea.height,
        0, 0, size, size,
    );
    return new Promise((resolve, reject) =>
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Canvas is empty")), "image/jpeg", 0.92)
    );
}

export default function ProfilePage() {
    const { user: clerkUser } = useUser();
    const { getToken } = useAuth();
    const { user, isAdmin } = useRole();
    const org = useQuery(api.organisations.queries.mine);
    const settings = useQuery(api.organisations.queries.getSettings);
    const updateProfile = useMutation(api.users.mutations.updateProfile);
    const updateSettings = useMutation(api.organisations.mutations.updateSettings);
    const disconnectGoogle = useMutation(api.users.mutations.disconnectGoogle);
    const [googleConnecting, setGoogleConnecting] = useState(false);
    const [googleDisconnecting, setGoogleDisconnecting] = useState(false);

    // Personal profile state
    const [profileForm, setProfileForm] = useState({ fullName: "" });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);

    // Avatar crop state
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
        setCroppedAreaPixels(areaPixels);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setCropSrc(reader.result as string);
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const handleCropConfirm = async () => {
        if (!cropSrc || !croppedAreaPixels || !clerkUser) return;
        setAvatarUploading(true);
        setCropSrc(null);
        try {
            const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
            const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
            await clerkUser.setProfileImage({ file });
            toast.success("Profile picture updated.");
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setAvatarUploading(false);
            setZoom(1);
            setCrop({ x: 0, y: 0 });
        }
    };

    // Org settings state (admin only)
    const [settingsForm, setSettingsForm] = useState({
        defaultCurrency: "USD",
        taxRate: 0,
        emailFromName: "",
        emailFromAddress: "",
    });
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileForm({ fullName: user.fullName ?? "" });
        }
    }, [user]);

    useEffect(() => {
        if (settings) {
            setSettingsForm({
                defaultCurrency: settings.defaultCurrency ?? "USD",
                taxRate: settings.taxRate ?? 0,
                emailFromName: settings.emailFromName ?? "",
                emailFromAddress: settings.emailFromAddress ?? "",
            });
        }
    }, [settings]);

    const handleProfileSave = async () => {
        setProfileSaving(true);
        setProfileSaved(false);
        try {
            const trimmed = profileForm.fullName.trim();
            // Split into first / last for Clerk (last word = lastName)
            const spaceIdx = trimmed.lastIndexOf(" ");
            const firstName = spaceIdx > -1 ? trimmed.slice(0, spaceIdx) : trimmed;
            const lastName = spaceIdx > -1 ? trimmed.slice(spaceIdx + 1) : "";
            await Promise.all([
                updateProfile({ fullName: trimmed }),
                clerkUser?.update({ firstName, lastName }),
            ]);
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 2500);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setProfileSaving(false);
        }
    };

    const handleSettingsSave = async () => {
        setSettingsSaving(true);
        setSettingsSaved(false);
        try {
            await updateSettings({
                defaultCurrency: settingsForm.defaultCurrency,
                taxRate: Number(settingsForm.taxRate),
                emailFromName: settingsForm.emailFromName || undefined,
                emailFromAddress: settingsForm.emailFromAddress || undefined,
            });
            setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 2500);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setSettingsSaving(false);
        }
    };

    const handleConnectGoogle = async () => {
        setGoogleConnecting(true);
        try {
            const token = await getToken({ template: "convex" });
            if (!token) throw new Error("Not authenticated");
            const popup = window.open(
                `/api/google-start?token=${encodeURIComponent(token)}`,
                "google-oauth",
                "width=500,height=650,left=100,top=100"
            );
            if (!popup) {
                toast.error("Popup was blocked. Please allow popups for this site.");
                setGoogleConnecting(false);
                return;
            }
            const onMessage = (e: MessageEvent) => {
                if (e.data === "google-connected") {
                    window.removeEventListener("message", onMessage);
                    toast.success("Google Calendar connected successfully.");
                    setGoogleConnecting(false);
                }
            };
            window.addEventListener("message", onMessage);
            const pollClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(pollClosed);
                    window.removeEventListener("message", onMessage);
                    setGoogleConnecting(false);
                }
            }, 500);
        } catch (error) {
            toast.error(getErrorMessage(error));
            setGoogleConnecting(false);
        }
    };

    const handleDisconnectGoogle = async () => {
        setGoogleDisconnecting(true);
        try {
            await disconnectGoogle({});
            toast.success("Google Calendar disconnected.");
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setGoogleDisconnecting(false);
        }
    };

    const roleLabel =
        user?.role === "admin" ? "Admin"
        : user?.role === "case_manager" ? "Case Manager"
        : user?.role === "accountant" ? "Accountant"
        : "Staff";

    return (
        <div className="space-y-6">
            {/* Personal profile — all users */}
            <Card>
                <CardHeader><CardTitle>My Profile</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {/* Profile picture */}
                    <div className="flex items-center gap-5">
                        {/* Avatar with camera overlay button */}
                        <div className="relative shrink-0">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={clerkUser?.imageUrl} alt={clerkUser?.fullName ?? "Avatar"} />
                                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                                    {(clerkUser?.firstName?.[0] ?? "") + (clerkUser?.lastName?.[0] ?? "") || "U"}
                                </AvatarFallback>
                            </Avatar>

                            {/* Uploading spinner overlay */}
                            {avatarUploading && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                                </div>
                            )}

                            {/* Camera button — bottom-right overlay */}
                            {!avatarUploading && (
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-opacity hover:opacity-90"
                                    aria-label="Change profile photo"
                                >
                                    <Camera className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <div>
                            <p className="text-sm font-medium text-foreground">{clerkUser?.fullName ?? "Your name"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Click the camera icon to update your photo</p>
                        </div>

                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>

                    {/* Crop dialog */}
                    <Dialog open={!!cropSrc} onOpenChange={(open) => { if (!open) setCropSrc(null); }}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Crop profile photo</DialogTitle>
                            </DialogHeader>
                            <div className="relative h-72 w-full overflow-hidden rounded-xl bg-black">
                                {cropSrc && (
                                    <Cropper
                                        image={cropSrc}
                                        crop={crop}
                                        zoom={zoom}
                                        aspect={1}
                                        cropShape="round"
                                        showGrid={false}
                                        onCropChange={setCrop}
                                        onZoomChange={setZoom}
                                        onCropComplete={onCropComplete}
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-3 px-1">
                                <span className="text-xs text-muted-foreground shrink-0">Zoom</span>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.01}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full accent-primary"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setCropSrc(null)}>Cancel</Button>
                                <Button onClick={handleCropConfirm}>Apply</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <div className="grid gap-2">
                        <Label>Full Name</Label>
                        <Input
                            value={profileForm.fullName}
                            onChange={(e) => setProfileForm({ fullName: e.target.value })}
                            placeholder="Your full name"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Email</Label>
                            <Input value={user?.email ?? ""} disabled className="bg-muted/50" />
                            <p className="text-xs text-muted-foreground">
                                Email is managed via your Clerk account.
                            </p>
                        </div>
                        <div className="grid gap-2 self-start">
                            <Label>Role</Label>
                            <div className="flex items-center h-9">
                                <Badge variant="outline" className="capitalize">{roleLabel}</Badge>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleProfileSave} disabled={profileSaving} className="gap-2">
                        {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {profileSaved ? "Saved!" : "Save Profile"}
                    </Button>
                </CardContent>
            </Card>

            {/* Organisation identity (read-only) */}
            <Card>
                <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Organisation Name</Label>
                        <Input value={org?.name ?? ""} disabled className="bg-muted/50" />
                        <p className="text-xs text-muted-foreground">
                            Organisation name is managed via your Clerk dashboard.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Plan</Label>
                            <Input value={org?.plan ?? ""} disabled className="bg-muted/50 capitalize" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Slug</Label>
                            <Input value={org?.slug ?? ""} disabled className="bg-muted/50" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Google Calendar — all roles */}
            <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                                <path d="M19 4h-1V2h-2v2H8V2H6v2H5C3.9 4 3 4.9 3 6v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z" fill="#4285F4"/>
                            </svg>
                            Google Calendar
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {user?.googleEmail ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <span>
                                        Connected as <strong>{user.googleEmail}</strong>
                                        {user.googleConnectedAt && (
                                            <span className="text-muted-foreground font-normal ml-1">
                                                (since {new Date(user.googleConnectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
                                    onClick={handleDisconnectGoogle}
                                    disabled={googleDisconnecting}
                                >
                                    {googleDisconnecting
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Unlink className="h-3.5 w-3.5" />
                                    }
                                    Disconnect
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                    Connect your Google account to automatically create Google Meet links when scheduling appointments. Invites will be sent from your Google email.
                                </p>
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={handleConnectGoogle}
                                    disabled={googleConnecting}
                                >
                                    {googleConnecting
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : (
                                            <svg viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                            </svg>
                                        )
                                    }
                                    Connect Google Calendar
                                </Button>
                            </div>
                        )}
                    </CardContent>
            </Card>

            {/* Admin-only: billing & email settings */}
            {isAdmin && (
                <>
                    <Card>
                        <CardHeader><CardTitle>Billing Defaults</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Default Currency</Label>
                                    <Input
                                        value={settingsForm.defaultCurrency}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, defaultCurrency: e.target.value.toUpperCase() })}
                                        placeholder="USD"
                                        maxLength={3}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Default Tax Rate (%)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                        value={settingsForm.taxRate}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, taxRate: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Email Sender Identity</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>From Name</Label>
                                    <Input
                                        value={settingsForm.emailFromName}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, emailFromName: e.target.value })}
                                        placeholder="e.g. Chen Immigration Law"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>From Email Address</Label>
                                    <Input
                                        type="email"
                                        value={settingsForm.emailFromAddress}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, emailFromAddress: e.target.value })}
                                        placeholder="e.g. noreply@yourfirm.com"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Used as the sender identity for outgoing emails (Phase 4 — Resend integration).
                            </p>
                        </CardContent>
                    </Card>

                    <Button onClick={handleSettingsSave} disabled={settingsSaving} className="gap-2">
                        {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {settingsSaved ? "Saved!" : "Save Settings"}
                    </Button>
                </>
            )}
        </div>
    );
}
